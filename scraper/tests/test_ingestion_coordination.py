import unittest
from datetime import datetime, timedelta, timezone

try:
    from ingestion_coordination import IngestionLeaseLost, acquire_ingestion_lease, assert_ingestion_lease, renew_ingestion_lease, transition_owned_job
except ModuleNotFoundError:
    from scraper.ingestion_coordination import IngestionLeaseLost, acquire_ingestion_lease, assert_ingestion_lease, renew_ingestion_lease, transition_owned_job


def matches(doc, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(doc, clause) for clause in expected):
                return False
            continue
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op, value in expected.items():
                if op == "$exists" and ((key in doc) != value): return False
                if op == "$lte" and (actual is None or actual > value): return False
                if op == "$gt" and (actual is None or actual <= value): return False
                if op == "$in" and actual not in value and not (actual is None and None in value): return False
        elif actual != expected:
            return False
    return True


class Control:
    def __init__(self): self.doc = None
    def update_one(self, query, update, upsert=False):
        if self.doc is None and upsert:
            self.doc = {"_id": query["_id"]}
            for key, value in update.get("$setOnInsert", {}).items(): self.doc[key] = value
            return type("Result", (), {"matched_count": 1})()
        if self.doc is None or not matches(self.doc, query): return type("Result", (), {"matched_count": 0})()
        for key, value in update.get("$inc", {}).items(): self.doc[key] = self.doc.get(key, 0) + value
        self.doc.update(update.get("$set", {}))
        for key in update.get("$unset", {}): self.doc.pop(key, None)
        return type("Result", (), {"matched_count": 1})()
    def find_one_and_update(self, query, update, upsert=False, return_document=None):
        if self.doc is None or not matches(self.doc, query): return None
        for key, value in update.get("$inc", {}).items(): self.doc[key] = self.doc.get(key, 0) + value
        self.doc.update(update.get("$set", {}))
        return dict(self.doc)
    def find_one(self, query): return dict(self.doc) if self.doc and matches(self.doc, query) else None


class Jobs:
    def __init__(self, doc): self.doc = dict(doc)
    def update_one(self, query, update):
        if not matches(self.doc, query): return type("Result", (), {"matched_count": 0})()
        self.doc.update(update.get("$set", {}))
        return type("Result", (), {"matched_count": 1})()


class IngestionCoordinationTests(unittest.TestCase):
    def test_only_one_process_can_acquire_and_expiry_fences_the_old_owner(self):
        control = Control()
        first = acquire_ingestion_lease(control, "worker-a", 30)
        second = acquire_ingestion_lease(control, "worker-b", 30)
        self.assertEqual(first["fencingToken"], 1)
        self.assertIsNone(second)
        control.doc["leaseExpiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        replacement = acquire_ingestion_lease(control, "worker-b", 30)
        self.assertEqual(replacement["fencingToken"], 2)
        with self.assertRaises(IngestionLeaseLost):
            assert_ingestion_lease(control, "worker-a", 1, None)

    def test_simulated_scraper_crash_leaves_running_job_unpublished_by_stale_worker(self):
        control = Control()
        jobs = Jobs({"_id": "job-a", "status": "running", "leaseOwner": "worker-a", "fencingToken": 1})
        first = acquire_ingestion_lease(control, "worker-a", 30)
        control.doc["activeIngestJobId"] = "job-a"
        self.assertEqual(first["fencingToken"], 1)
        # The child crashes during scraping: its heartbeat stops and the lease expires.
        control.doc["leaseExpiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        acquire_ingestion_lease(control, "worker-b", 30)
        completed = transition_owned_job(control, jobs, "job-a", "worker-a", 1, {"status": "completed"})
        self.assertFalse(completed)
        self.assertEqual(jobs.doc["status"], "running")

    def test_current_lease_can_renew_only_for_its_job(self):
        control = Control()
        lease = acquire_ingestion_lease(control, "worker-a", 30)
        control.doc["activeIngestJobId"] = "job-a"
        renew_ingestion_lease(control, "worker-a", lease["fencingToken"], "job-a", 30)
        with self.assertRaises(IngestionLeaseLost):
            renew_ingestion_lease(control, "worker-a", lease["fencingToken"], "job-b", 30)


if __name__ == "__main__": unittest.main()
