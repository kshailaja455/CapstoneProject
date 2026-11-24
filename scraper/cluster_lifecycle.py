"""Fenced, staged cluster generation lifecycle.

All database handles are injected so lifecycle tests can use isolated in-memory
collections and production code never needs to contact MongoDB from the tests.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import uuid

from bson import ObjectId
from pymongo import ReturnDocument, UpdateOne


CONTROL_ID = "cluster-lifecycle"


class ClusterGenerationError(RuntimeError):
    pass


class ClusterLeaseLost(ClusterGenerationError):
    pass


def _now():
    return datetime.now(timezone.utc)


def _id_text(value):
    return str(value)


def _fingerprint(articles):
    captured = []
    for article in articles:
        captured.append({
            "id": _id_text(article["_id"]),
            "title": article.get("title") or "",
            "summary": article.get("summary") or "",
            "body": article.get("body") or "",
            "publishedAt": article.get("publishedAt").isoformat() if article.get("publishedAt") else None,
            "contentHash": article.get("contentHash") or "",
        })
    encoded = json.dumps(captured, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _acquire(control, owner, lease_seconds):
    now = _now()
    # Initialize the singleton separately; an upsert on the lease predicate
    # could otherwise collide with an existing but currently-held _id.
    control.update_one(
        {"_id": CONTROL_ID},
        {"$setOnInsert": {"activeGenerationId": None, "fencingToken": 0}},
        upsert=True,
    )
    return control.find_one_and_update(
        {
            "_id": CONTROL_ID,
            "$or": [
                {"leaseExpiresAt": {"$exists": False}},
                {"leaseExpiresAt": {"$lte": now}},
            ],
        },
        {
            "$inc": {"fencingToken": 1},
            "$set": {"leaseOwner": owner, "leaseExpiresAt": now + timedelta(seconds=lease_seconds)},
            "$setOnInsert": {"activeGenerationId": None},
        },
        upsert=False,
        return_document=ReturnDocument.AFTER,
    )


def _renew(control, owner, token, lease_seconds, job_id=None):
    now = _now()
    query = {"_id": CONTROL_ID, "leaseOwner": owner, "fencingToken": token, "leaseExpiresAt": {"$gt": now}}
    if job_id:
        query["activeIngestJobId"] = job_id
    result = control.update_one(
        query,
        {"$set": {"leaseExpiresAt": now + timedelta(seconds=lease_seconds)}},
    )
    if result.matched_count != 1:
        raise ClusterLeaseLost("Cluster rebuild lease expired or was superseded")


def _release(control, owner, token):
    control.update_one(
        {"_id": CONTROL_ID, "leaseOwner": owner, "fencingToken": token},
        {"$unset": {"leaseOwner": "", "leaseExpiresAt": ""}},
    )


def _mark_generation(generations, generation_id, token, state, **fields):
    generations.update_one(
        {"generationId": generation_id, "fencingToken": token},
        {"$set": {"state": state, "updatedAt": _now(), **fields}},
    )


def _cluster_membership(clusters, generation_id):
    docs = list(clusters.find({"generationId": generation_id}))
    membership = {}
    for cluster in docs:
        for article_id in cluster.get("articleIds", []):
            key = _id_text(article_id)
            membership.setdefault(key, []).append(cluster["_id"])
    return docs, membership


def _validate_staged(generations, clusters, articles, captured_articles, generation_id, token):
    generation = generations.find_one({"generationId": generation_id, "fencingToken": token})
    docs, membership = _cluster_membership(clusters, generation_id)
    expected_ids = generation["inputArticleIds"]
    expected = set(expected_ids)
    actual = set(membership)
    live_articles = list(articles.find({"_id": {"$in": [article["_id"] for article in captured_articles]}}))
    live_by_id = {_id_text(article["_id"]): article for article in live_articles}
    missing_live_ids = sorted(expected - set(live_by_id))
    live_in_capture_order = [live_by_id[article_id] for article_id in expected_ids if article_id in live_by_id]
    input_changed = not missing_live_ids and _fingerprint(live_in_capture_order) != generation["inputFingerprint"]
    duplicates = sorted(article_id for article_id, ids in membership.items() if len(ids) != 1)
    valid = (
        generation is not None
        and len(docs) == generation["expectedClusterCount"]
        and expected == actual
        and not duplicates
        and not missing_live_ids
        and not input_changed
        and len(docs) > 0
    )
    details = {
        "expectedArticleCount": len(expected),
        "assignedArticleCount": len(actual),
        "clusterCount": len(docs),
        "missingArticleIds": sorted(expected - actual),
        "unexpectedArticleIds": sorted(actual - expected),
        "duplicateArticleIds": duplicates,
        "missingLiveArticleIds": missing_live_ids,
        "capturedArticleContentChanged": input_changed,
    }
    return valid, details


def _apply_article_references(articles, clusters, generation_id, token, fault_hook=None):
    docs = list(clusters.find({"generationId": generation_id}))
    for index, cluster in enumerate(docs):
        operations = []
        for article_id in cluster.get("articleIds", []):
            operations.append(UpdateOne(
                {
                    "_id": article_id,
                    "$or": [
                        {"clusterGenerationFence": {"$exists": False}},
                        {"clusterGenerationFence": {"$lte": token}},
                    ],
                },
                {"$set": {
                    "clusterId": cluster["_id"],
                    "clusterGenerationFence": token,
                    "processingStatus": "clustered",
                }},
            ))
        if operations:
            articles.bulk_write(operations, ordered=False)
        if fault_hook:
            fault_hook("after_article_reference_batch", index)


def rebuild_cluster_generation(
    articles,
    clusters,
    generations,
    control,
    cluster_builder,
    max_articles,
    lease_seconds=120,
    fault_hook=None,
    lease_owner=None,
    fencing_token=None,
    ingest_job_id=None,
    jobs=None,
):
    """Build and activate a complete generation. Returns its cluster count.

    Old clusters are never deleted. References are written only after activation
    and use a monotonically increasing fencing token to make retries idempotent
    and prevent an older process overwriting a newer assignment.
    """
    captured = list(articles.find({}).sort("publishedAt", -1).limit(max_articles))
    if not captured:
        return 0

    owns_lease = lease_owner is None or fencing_token is None
    owner = str(uuid.uuid4()) if owns_lease else lease_owner
    if owns_lease:
        lease = _acquire(control, owner, lease_seconds)
        if not lease or lease.get("leaseOwner") != owner:
            return 0
        token = lease["fencingToken"]
        expected_active = lease.get("activeGenerationId")
    else:
        token = fencing_token
        lease_query = {"_id": CONTROL_ID, "leaseOwner": owner, "fencingToken": token, "leaseExpiresAt": {"$gt": _now()}}
        if ingest_job_id:
            lease_query["activeIngestJobId"] = ingest_job_id
        lease = control.find_one(lease_query)
        if not lease:
            raise ClusterLeaseLost("Ingestion lease missing or superseded before cluster rebuild")
        expected_active = lease.get("activeGenerationId")
    activated_generation_id = None

    def inject(point, index=None):
        if fault_hook:
            fault_hook(point, index)

    try:
        _renew(control, owner, token, lease_seconds, ingest_job_id)

        # Recover an already active generation first. Activation is permanent;
        # interrupted reference updates are completed before another rebuild.
        if expected_active:
            active = generations.find_one({"generationId": expected_active})
            if active and not active.get("referenceUpdatesComplete", False):
                _apply_article_references(articles, clusters, expected_active, active["fencingToken"])
                generations.update_one(
                    {"generationId": expected_active},
                    {"$set": {"state": "ACTIVE", "referenceUpdatesComplete": True, "referencesCompletedAt": _now()}},
                )
                old_job_id = active.get("ingestJobId")
                if jobs is not None and old_job_id and old_job_id != ingest_job_id:
                    _renew(control, owner, token, lease_seconds, ingest_job_id)
                    now = _now()
                    transition = control.update_one({
                        "_id": CONTROL_ID, "leaseOwner": owner, "fencingToken": token,
                        "activeIngestJobId": ingest_job_id, "leaseExpiresAt": {"$gt": now},
                    }, {"$set": {"lastIngestJobTransition": {
                        "jobId": old_job_id, "fencingToken": active.get("fencingToken"),
                        "status": "completed", "recoveredByFence": token, "at": now,
                    }}})
                    if transition.matched_count == 1:
                        try:
                            old_job_key = ObjectId(old_job_id)
                        except Exception:
                            old_job_key = old_job_id
                        jobs.update_one({
                            "_id": old_job_key,
                            "status": "running",
                            "fencingToken": active.get("fencingToken"),
                            "recoveryStatus": "GENERATION_ACTIVE_REFERENCE_UPDATES_PENDING",
                        }, {"$set": {
                            "status": "completed", "finishedAt": now,
                            "clusterGenerationId": expected_active,
                            "recoveryStatus": "COMPLETED_AFTER_REFERENCE_RECOVERY",
                            "recoveryError": None,
                            "narrativeStatus": "superseded",
                            "narrativeError": "The recovered generation was superseded before its post-ingest analysis could run.",
                        }})

        _renew(control, owner, token, lease_seconds, ingest_job_id)
        generation_id = str(uuid.uuid4())
        input_ids = [_id_text(article["_id"]) for article in captured]
        generations.insert_one({
            "generationId": generation_id,
            "state": "STAGING",
            "fencingToken": token,
            "ingestJobId": ingest_job_id,
            "inputArticleIds": input_ids,
            "inputFingerprint": _fingerprint(captured),
            "inputArticleCount": len(input_ids),
            "expectedClusterCount": None,
            "clusterIds": [],
            "referenceUpdatesComplete": False,
            "createdAt": _now(),
            "updatedAt": _now(),
        })

        generated = cluster_builder(captured)
        if not generated:
            _mark_generation(generations, generation_id, token, "FAILED", failureReason="Nonempty input produced no clusters")
            raise ClusterGenerationError("Nonempty input produced no clusters")

        seen_indexes = []
        cluster_docs = []
        for item in generated:
            indexes = item.get("articleIndexes", [])
            if not indexes:
                continue
            for article_index in indexes:
                if not isinstance(article_index, int) or article_index < 0 or article_index >= len(captured):
                    _mark_generation(generations, generation_id, token, "FAILED", failureReason="Invalid article index")
                    raise ClusterGenerationError("Generated cluster contains an invalid article index")
                seen_indexes.append(article_index)
            members = [captured[index] for index in indexes]
            article_ids = [member["_id"] for member in members]
            published_times = [member.get("publishedAt") or member.get("fetchedAt") or _now() for member in members]
            cluster_docs.append({
                "_id": ObjectId(),
                "generationId": generation_id,
                "generationFence": token,
                "label": item.get("label") or "Untitled event",
                "topTerms": item.get("topTerms", []),
                "articleIds": article_ids,
                "sources": sorted({member.get("source", "Unknown") for member in members}),
                "articleCount": len(article_ids),
                "startTime": min(published_times),
                "endTime": max(published_times),
                "representativeArticleId": article_ids[0],
                "createdAt": _now(),
                "updatedAt": _now(),
            })

        if sorted(seen_indexes) != list(range(len(captured))):
            _mark_generation(generations, generation_id, token, "FAILED", failureReason="Generated clusters do not partition the captured article set")
            raise ClusterGenerationError("Generated clusters must assign every captured article exactly once")

        generations.update_one(
            {"generationId": generation_id, "fencingToken": token},
            {"$set": {"expectedClusterCount": len(cluster_docs), "state": "STAGING", "updatedAt": _now()}},
        )
        for index, doc in enumerate(cluster_docs):
            _renew(control, owner, token, lease_seconds, ingest_job_id)
            clusters.insert_one(doc)
            inject("after_cluster_staged", index)

        generations.update_one(
            {"generationId": generation_id, "fencingToken": token},
            {"$set": {"clusterIds": [doc["_id"] for doc in cluster_docs], "state": "VALIDATING", "updatedAt": _now()}},
        )
        _renew(control, owner, token, lease_seconds, ingest_job_id)
        valid, validation = _validate_staged(generations, clusters, articles, captured, generation_id, token)
        if not valid:
            _mark_generation(generations, generation_id, token, "FAILED", validation=validation, failureReason="Staged generation failed integrity validation")
            raise ClusterGenerationError("Staged generation failed integrity validation")
        generations.update_one(
            {"generationId": generation_id, "fencingToken": token},
            {"$set": {"state": "VALIDATED", "validation": validation, "validatedAt": _now()}},
        )
        inject("after_validation", None)

        _renew(control, owner, token, lease_seconds, ingest_job_id)
        cas_filter = {
            "_id": CONTROL_ID,
            "fencingToken": token,
            "leaseOwner": owner,
            "leaseExpiresAt": {"$gt": _now()},
        }
        if ingest_job_id:
            cas_filter["activeIngestJobId"] = ingest_job_id
        cas_filter["activeGenerationId"] = expected_active if expected_active is not None else {"$in": [None]}
        activation = control.update_one(cas_filter, {"$set": {
            "activeGenerationId": generation_id,
            "activeGenerationFence": token,
            "activeGenerationActivatedAt": _now(),
        }})
        if activation.modified_count != 1:
            raise ClusterLeaseLost("Generation activation compare-and-set failed")
        activated_generation_id = generation_id
        inject("after_activation", None)

        _mark_generation(generations, generation_id, token, "ACTIVE", activatedAt=_now())
        _apply_article_references(articles, clusters, generation_id, token, fault_hook)
        generations.update_one(
            {"generationId": generation_id, "fencingToken": token},
            {"$set": {"referenceUpdatesComplete": True, "referencesCompletedAt": _now()}},
        )
        return len(cluster_docs)
    except Exception as error:
        if activated_generation_id is None:
            # Do not let a superseded worker change the active generation. Its
            # unactivated stage is retained for inspection and ignored by readers.
            if "generation_id" in locals():
                generations.update_one(
                    {"generationId": generation_id, "fencingToken": token, "state": {"$ne": "ACTIVE"}},
                    {"$set": {"state": "FAILED", "failureReason": str(error), "updatedAt": _now()}},
                )
        raise
    finally:
        if owns_lease:
            _release(control, owner, token)
