import copy
import unittest
from datetime import datetime, timedelta, timezone
from bson import ObjectId

try:
    from cluster_lifecycle import ClusterGenerationError, ClusterLeaseLost, _acquire, rebuild_cluster_generation
except ModuleNotFoundError:
    from scraper.cluster_lifecycle import ClusterGenerationError, ClusterLeaseLost, _acquire, rebuild_cluster_generation


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, option) for option in expected):
                return False
            continue
        actual = document.get(key)
        if isinstance(expected, dict):
            for operator, value in expected.items():
                if operator == "$exists" and ((key in document) != value):
                    return False
                if operator == "$lte" and (actual is None or actual > value):
                    return False
                if operator == "$lt" and (actual is None or actual >= value):
                    return False
                if operator == "$gt" and (actual is None or actual <= value):
                    return False
                if operator == "$ne" and actual == value:
                    return False
                if operator == "$in" and actual not in value and not (actual is None and None in value):
                    return False
        elif actual != expected:
            return False
    return True


def apply_update(document, update):
    for key, value in update.get("$setOnInsert", {}).items():
        document.setdefault(key, value)
    for key, value in update.get("$inc", {}).items():
        document[key] = document.get(key, 0) + value
    document.update(update.get("$set", {}))
    for key in update.get("$unset", {}):
        document.pop(key, None)


class Result:
    def __init__(self, matched_count=0, modified_count=0):
        self.matched_count = matched_count
        self.modified_count = modified_count


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction):
        self.docs.sort(key=lambda doc: doc.get(key) or datetime.min.replace(tzinfo=timezone.utc), reverse=direction < 0)
        return self

    def limit(self, count):
        self.docs = self.docs[:count]
        return self

    def __iter__(self):
        return iter(self.docs)


class Collection:
    def __init__(self, docs=None):
        self.docs = [copy.deepcopy(doc) for doc in (docs or [])]

    def find(self, query):
        return Cursor([copy.deepcopy(doc) for doc in self.docs if matches(doc, query)])

    def find_one(self, query):
        return next((copy.deepcopy(doc) for doc in self.docs if matches(doc, query)), None)

    def find_one_and_update(self, query, update, upsert=False, return_document=None):
        doc = next((doc for doc in self.docs if matches(doc, query)), None)
        if doc is None:
            if not upsert:
                return None
            doc = {"_id": query.get("_id")}
            self.docs.append(doc)
        apply_update(doc, update)
        return copy.deepcopy(doc)

    def insert_one(self, document):
        self.docs.append(copy.deepcopy(document))
        return type("InsertResult", (), {"inserted_id": document.get("_id")})()

    def update_one(self, query, update, upsert=False):
        doc = next((doc for doc in self.docs if matches(doc, query)), None)
        if doc is None:
            if upsert:
                doc = {key: value for key, value in query.items() if not key.startswith("$") and not isinstance(value, dict)}
                self.docs.append(doc)
            else:
                return Result()
        before = copy.deepcopy(doc)
        apply_update(doc, update)
        return Result(1, int(doc != before))

    def bulk_write(self, operations, ordered=False):
        for operation in operations:
            doc = next((doc for doc in self.docs if matches(doc, operation._filter)), None)
            if doc is not None:
                apply_update(doc, operation._doc)


def make_articles(count=3):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return Collection([
        {"_id": f"article-{index}", "title": f"Headline {index}", "summary": "summary", "body": "body text", "contentHash": f"hash-{index}", "publishedAt": now + timedelta(days=index), "source": "Publisher"}
        for index in range(count)
    ])


def group_builder(items):
    return [{"label": "one", "topTerms": ["headline"], "articleIndexes": list(range(len(items)))}]


class ClusterLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.articles = make_articles(4)
        self.articles.docs[0]["clusterId"] = "historical-cluster"
        self.clusters = Collection([{"_id": "historical-cluster", "articleIds": ["article-0"], "label": "old"}])
        self.generations = Collection()
        self.control = Collection()

    def rebuild(self, builder=group_builder, hook=None, max_articles=2):
        return rebuild_cluster_generation(self.articles, self.clusters, self.generations, self.control, builder, max_articles, fault_hook=hook)

    def active_id(self):
        return self.control.find_one({"_id": "cluster-lifecycle"}).get("activeGenerationId")

    def test_success_captures_fingerprint_and_leaves_old_window_memberships_intact(self):
        count = self.rebuild()
        self.assertEqual(count, 1)
        active = self.active_id()
        generation = self.generations.find_one({"generationId": active})
        self.assertEqual(generation["inputArticleIds"], ["article-3", "article-2"])
        self.assertEqual(len(generation["inputFingerprint"]), 64)
        self.assertTrue(generation["referenceUpdatesComplete"])
        self.assertEqual(self.articles.docs[0]["clusterId"], "historical-cluster")
        self.assertEqual(len(self.clusters.docs), 2)
        for cluster in [doc for doc in self.clusters.docs if doc.get("generationId") == active]:
            for article_id in cluster["articleIds"]:
                member = next(doc for doc in self.articles.docs if doc["_id"] == article_id)
                self.assertEqual(member["clusterId"], cluster["_id"])
                self.assertEqual(member["clusterGenerationFence"], generation["fencingToken"])

    def test_failure_after_staging_preserves_active_generation_and_references(self):
        self.rebuild()
        old_active = self.active_id()
        old_refs = [doc.get("clusterId") for doc in self.articles.docs]

        def fail(point, _index):
            if point == "after_cluster_staged":
                raise RuntimeError("simulated crash after staging")

        with self.assertRaises(RuntimeError):
            self.rebuild(hook=fail)
        self.assertEqual(self.active_id(), old_active)
        self.assertEqual([doc.get("clusterId") for doc in self.articles.docs], old_refs)
        self.assertTrue(any(doc.get("generationId") and doc.get("generationId") != old_active for doc in self.clusters.docs))

    def test_empty_or_partial_generation_cannot_activate(self):
        with self.assertRaises(ClusterGenerationError):
            self.rebuild(builder=lambda _items: [])
        with self.assertRaises(ClusterGenerationError):
            self.rebuild(builder=lambda _items: [{"label": "partial", "articleIndexes": [0]}])
        self.assertIsNone(self.control.find_one({"_id": "cluster-lifecycle"}).get("activeGenerationId"))
        self.assertEqual(next(doc for doc in self.articles.docs if doc["_id"] == "article-0")["clusterId"], "historical-cluster")
        self.assertTrue(all("clusterGenerationFence" not in doc for doc in self.articles.docs))

    def test_validation_failure_does_not_replace_active_generation(self):
        self.rebuild()
        prior = self.active_id()

        def fail(point, _index):
            if point == "after_validation":
                raise RuntimeError("simulated process interruption after validation")

        with self.assertRaises(RuntimeError):
            self.rebuild(hook=fail)
        self.assertEqual(self.active_id(), prior)

    def test_article_content_change_during_staging_prevents_activation(self):
        def mutate_during_build(items):
            self.articles.docs[3]["body"] = "content changed after capture"
            return group_builder(items)

        with self.assertRaises(ClusterGenerationError):
            self.rebuild(builder=mutate_during_build)
        self.assertIsNone(self.control.find_one({"_id": "cluster-lifecycle"}).get("activeGenerationId"))

    def test_activation_is_not_rolled_back_and_next_run_recovers_references_first(self):
        def crash(point, _index):
            if point == "after_activation":
                raise RuntimeError("simulated crash immediately after activation")

        with self.assertRaises(RuntimeError):
            self.rebuild(hook=crash)
        active = self.active_id()
        self.assertIsNotNone(active)
        self.assertFalse(self.generations.find_one({"generationId": active})["referenceUpdatesComplete"])

        def inspect_recovery(items):
            current = [article for article in self.articles.docs if article["_id"] in {item["_id"] for item in items}]
            self.assertTrue(all(article.get("clusterId") for article in current))
            self.assertTrue(all(article.get("clusterGenerationFence", 0) > 0 for article in current))
            raise RuntimeError("stop after verifying recovery")

        with self.assertRaises(RuntimeError):
            self.rebuild(builder=inspect_recovery)
        self.assertTrue(self.generations.find_one({"generationId": active})["referenceUpdatesComplete"])

    def test_partial_reference_update_is_recoverable_without_deactivation(self):
        def two_groups(items):
            return [
                {"label": "first", "articleIndexes": [0]},
                {"label": "second", "articleIndexes": [1]},
            ]

        def fail_after_first(point, index):
            if point == "after_article_reference_batch" and index == 0:
                raise RuntimeError("simulated partial pointer update")

        with self.assertRaises(RuntimeError):
            self.rebuild(builder=two_groups, hook=fail_after_first)
        active = self.active_id()
        self.assertIsNotNone(active)
        self.assertFalse(self.generations.find_one({"generationId": active})["referenceUpdatesComplete"])

        def verify_then_stop(items):
            ids = {item["_id"] for item in items}
            current = [article for article in self.articles.docs if article["_id"] in ids]
            self.assertTrue(all(article.get("clusterGenerationFence") == 1 for article in current))
            raise RuntimeError("recovered pointers verified")

        with self.assertRaises(RuntimeError):
            self.rebuild(builder=verify_then_stop)
        self.assertTrue(self.generations.find_one({"generationId": active})["referenceUpdatesComplete"])
        self.assertEqual(self.active_id(), active)

    def test_expired_and_superseded_worker_cannot_activate(self):
        self.rebuild()
        prior = self.active_id()

        def supersede(point, _index):
            if point == "after_validation":
                state = self.control.docs[0]
                state["fencingToken"] += 1
                state["leaseOwner"] = "newer-worker"
                state["leaseExpiresAt"] = datetime.now(timezone.utc) + timedelta(minutes=1)

        with self.assertRaises(ClusterLeaseLost):
            self.rebuild(hook=supersede)
        self.assertEqual(self.active_id(), prior)
        self.assertEqual(self.control.docs[0]["leaseOwner"], "newer-worker")

    def test_only_one_live_rebuild_lease_is_granted_and_expiry_advances_fence(self):
        first = _acquire(self.control, "worker-one", 120)
        denied = _acquire(self.control, "worker-two", 120)
        self.assertEqual(first["fencingToken"], 1)
        self.assertIsNone(denied)
        self.control.docs[0]["leaseExpiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        second = _acquire(self.control, "worker-two", 120)
        self.assertEqual(second["fencingToken"], 2)

    def test_repeated_rebuilds_retain_history_and_fences_are_monotonic(self):
        self.rebuild()
        first_active = self.active_id()
        first_clusters = len(self.clusters.docs)
        self.rebuild()
        second_active = self.active_id()
        self.assertNotEqual(first_active, second_active)
        self.assertGreater(len(self.clusters.docs), first_clusters)
        self.assertEqual(self.generations.find_one({"generationId": second_active})["fencingToken"], 2)
        article = next(doc for doc in self.articles.docs if doc["_id"] == "article-2")
        self.assertEqual(article["clusterGenerationFence"], 2)

    def test_backend_ingestion_lease_is_reused_for_generation_activation(self):
        owner = "backend-worker"
        job_id = "job-123"
        self.control.insert_one({
            "_id": "cluster-lifecycle", "activeGenerationId": None, "fencingToken": 9,
            "leaseOwner": owner, "activeIngestJobId": job_id,
            "leaseExpiresAt": datetime.now(timezone.utc) + timedelta(minutes=2),
        })
        count = rebuild_cluster_generation(
            self.articles, self.clusters, self.generations, self.control, group_builder, 2,
            lease_owner=owner, fencing_token=9, ingest_job_id=job_id,
        )
        self.assertEqual(count, 1)
        generation = self.generations.find_one({"generationId": self.active_id()})
        self.assertEqual(generation["fencingToken"], 9)
        self.assertEqual(generation["ingestJobId"], job_id)
        self.assertEqual(self.control.docs[0]["leaseOwner"], owner)
        self.assertEqual(self.control.docs[0]["fencingToken"], 9)

    def test_recovery_completes_only_a_job_explicitly_marked_for_reference_recovery(self):
        old_job_id = ObjectId()
        current_owner = "new-worker"
        current_job = "new-job"
        old_generation = "gen-old"
        self.control.insert_one({
            "_id": "cluster-lifecycle", "activeGenerationId": old_generation, "fencingToken": 2,
            "leaseOwner": current_owner, "activeIngestJobId": current_job,
            "leaseExpiresAt": datetime.now(timezone.utc) + timedelta(minutes=2),
        })
        self.generations.insert_one({
            "generationId": old_generation, "state": "ACTIVE", "fencingToken": 1,
            "ingestJobId": str(old_job_id), "inputArticleIds": ["article-3", "article-2"],
            "inputFingerprint": "captured", "inputArticleCount": 2, "expectedClusterCount": 1,
            "referenceUpdatesComplete": False,
        })
        self.clusters.insert_one({
            "_id": "old-cluster", "generationId": old_generation, "generationFence": 1,
            "articleIds": ["article-3", "article-2"],
        })
        jobs = Collection([{
            "_id": old_job_id, "status": "running", "leaseOwner": "old-worker", "fencingToken": 1,
            "recoveryStatus": "GENERATION_ACTIVE_REFERENCE_UPDATES_PENDING",
        }])
        rebuild_cluster_generation(
            self.articles, self.clusters, self.generations, self.control, group_builder, 2,
            lease_owner=current_owner, fencing_token=2, ingest_job_id=current_job, jobs=jobs,
        )
        recovered = jobs.find_one({"_id": old_job_id})
        self.assertEqual(recovered["status"], "completed")
        self.assertEqual(recovered["recoveryStatus"], "COMPLETED_AFTER_REFERENCE_RECOVERY")
        self.assertTrue(self.generations.find_one({"generationId": old_generation})["referenceUpdatesComplete"])


if __name__ == "__main__":
    unittest.main()
