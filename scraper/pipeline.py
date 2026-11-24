from datetime import datetime, timezone
import argparse
import hashlib
import os
import uuid

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from clustering.tfidf import cluster_articles
from config import MAX_ARTICLES_FOR_CLUSTERING
from database.mongo import articles, clusters, cluster_generations, cluster_generation_controls, jobs, db
from cluster_lifecycle import rebuild_cluster_generation
from ingestion_coordination import IngestionLeaseHeartbeat, IngestionLeaseLost, acquire_ingestion_lease, assert_ingestion_lease, transition_owned_job
from extractor.article_extractor import extract_article
from feeds.fetch import fetch_articles

publishers = db["publishers"]


def utc_now():
    return datetime.now(timezone.utc)


def content_hash(article):
    source = "|".join([
        article.get("title", ""),
        article.get("summary", ""),
        article.get("body", ""),
    ])
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def normalize_article(article):
    body = extract_article(article["url"])
    article["body"] = body or ""
    article["fetchedAt"] = utc_now()
    if not article.get("discoveredAt"):
        article["discoveredAt"] = article["fetchedAt"]
    article["contentHash"] = content_hash(article)
    article["language"] = article.get("language") or "en"
    article["category"] = article.get("category") or "General"
    article["processingStatus"] = "processed"
    return article


def _article_fence_filter(article_id_or_url, token, key):
    return {
        key: article_id_or_url,
        "$or": [
            {"ingestionFence": {"$exists": False}},
            {"ingestionFence": None},
            {"ingestionFence": {"$lte": token}},
        ],
    }


def persist_articles(feed_articles, fencing_token, assert_lease):
    seen_urls = set()
    duplicates = 0
    body_backfills = 0
    inserted = 0

    for article in feed_articles:
        assert_lease()
        url = article["url"]
        if url in seen_urls:
            duplicates += 1
            continue
        seen_urls.add(url)

        existing = articles.find_one({"url": url}, {"_id": 1, "body": 1, "ingestionFence": 1})
        if existing:
            duplicates += 1
            if existing.get("ingestionFence", 0) is not None and existing.get("ingestionFence", 0) > fencing_token:
                continue
            if not existing.get("body"):
                normalized = normalize_article(article)
                assert_lease()
                result = articles.update_one(
                    _article_fence_filter(existing["_id"], fencing_token, "_id"),
                    {"$set": {
                        "body": normalized["body"],
                        "summary": normalized["summary"],
                        "contentHash": normalized["contentHash"],
                        "fetchedAt": normalized["fetchedAt"],
                        "processingStatus": "processed",
                        "ingestionFence": fencing_token,
                    }},
                )
                body_backfills += int(result.matched_count == 1)
            else:
                assert_lease()
                articles.update_one(
                    _article_fence_filter(existing["_id"], fencing_token, "_id"),
                    {"$set": {"ingestionFence": fencing_token}},
                )
            continue

        normalized = normalize_article(article)
        assert_lease()
        try:
            result = articles.update_one(
                _article_fence_filter(normalized["url"], fencing_token, "url"),
                {"$setOnInsert": normalized, "$set": {"ingestionFence": fencing_token}},
                upsert=True,
            )
            inserted += int(result.upserted_id is not None)
            duplicates += int(result.upserted_id is None)
        except DuplicateKeyError:
            # A higher-fence worker inserted this URL after our lookup.
            duplicates += 1

    return inserted, duplicates, body_backfills


def rebuild_clusters(lease_owner, fencing_token, job_id, assert_lease, lease_seconds=120):
    assert_lease()
    return rebuild_cluster_generation(
        articles=articles,
        clusters=clusters,
        generations=cluster_generations,
        control=cluster_generation_controls,
        cluster_builder=cluster_articles,
        max_articles=MAX_ARTICLES_FOR_CLUSTERING,
        lease_seconds=lease_seconds,
        lease_owner=lease_owner,
        fencing_token=fencing_token,
        ingest_job_id=job_id,
        jobs=jobs,
    )


def update_publisher_metrics(feed_results):
    if publishers is None:
        return

    now = utc_now()
    for fr in feed_results:
        source_name = fr["source"]
        feed_url = fr["url"]
        status = fr["status"]
        err = fr["error"]

        try:
            # Update feed status in publisher document
            publishers.update_one(
                {"name": source_name, "feeds.url": feed_url},
                {
                    "$set": {
                        "feeds.$.lastFetchedAt": now,
                        "feeds.$.lastStatus": status,
                        "feeds.$.lastError": err,
                        "lastIngestionAt": now,
                    }
                }
            )

            # Update overall publisher stored count and health
            count = articles.count_documents({"source": source_name})
            has_errors = (status == "error")
            health = "error" if has_errors else "healthy"

            publishers.update_one(
                {"name": source_name},
                {
                    "$set": {
                        "totalStoredCount": count,
                        "health": health,
                        "lastIngestionAt": now,
                    }
                }
            )
        except Exception as e:
            print(f"Note: Could not update publisher metrics for {source_name}: {e}")


def mark_job(job_id, lease_owner, fencing_token, update, expected_status="running"):
    if not job_id:
        return True
    return transition_owned_job(cluster_generation_controls, jobs, ObjectId(job_id), lease_owner, fencing_token, update, expected_status)


def main(job_id=None, lease_owner=None, fencing_token=None, lease_seconds=120):
    owns_lease = lease_owner is None or fencing_token is None
    if owns_lease:
        lease = acquire_ingestion_lease(cluster_generation_controls, lease_seconds=lease_seconds)
        if not lease:
            raise IngestionLeaseLost("Another ingestion process owns the cluster lifecycle lease")
        lease_owner = lease["owner"]
        fencing_token = lease["fencingToken"]
        if job_id:
            job = jobs.find_one({"_id": ObjectId(job_id), "status": "pending"})
            if not job:
                raise RuntimeError("A standalone scraper may only claim a pending ingestion job")
            claimed = jobs.update_one({"_id": ObjectId(job_id), "status": "pending"}, {"$set": {
                "status": "running", "startedAt": utc_now(), "leaseOwner": lease_owner,
                "fencingToken": fencing_token,
            }})
            if claimed.matched_count != 1:
                cluster_generation_controls.update_one({
                    "_id": "cluster-lifecycle", "leaseOwner": lease_owner, "fencingToken": fencing_token,
                }, {"$unset": {"leaseOwner": "", "leaseExpiresAt": "", "leasePurpose": ""}})
                raise RuntimeError("A standalone scraper may only claim a pending ingestion job")
        attached = cluster_generation_controls.update_one({
            "_id": "cluster-lifecycle", "leaseOwner": lease_owner, "fencingToken": fencing_token,
        }, {"$set": {"activeIngestJobId": job_id}})
        if attached.matched_count != 1:
            raise IngestionLeaseLost("Could not attach the ingestion job to its lease")
    elif not job_id:
        raise ValueError("A job ID is required when a backend-owned lease is supplied")

    heartbeat = IngestionLeaseHeartbeat(
        cluster_generation_controls, lease_owner, fencing_token, job_id, lease_seconds,
    )
    try:
        heartbeat.start()
        if job_id and not jobs.find_one({
            "_id": ObjectId(job_id), "status": "running", "leaseOwner": lease_owner, "fencingToken": fencing_token,
        }):
            raise IngestionLeaseLost("Ingestion job is no longer owned by this worker")

        heartbeat.assert_valid()
        feed_articles = fetch_articles()
        inserted, duplicates, body_backfills = persist_articles(
            feed_articles["articles"], fencing_token, heartbeat.assert_valid,
        )

        update_publisher_metrics(feed_articles.get("feedResults", []))
        total_stored_count = articles.count_documents({})
        progress_saved = mark_job(job_id, lease_owner, fencing_token, {
            "status": "running",
            "insertedCount": inserted,
            "duplicateCount": duplicates,
            "failedFeedCount": len(feed_articles["failedFeeds"]),
            "failedFeeds": feed_articles["failedFeeds"],
            "successfulFeedCount": feed_articles["successfulFeedCount"],
            "totalStoredCount": total_stored_count,
            "bodyBackfillCount": body_backfills,
            "nonEnglishSkipped": feed_articles.get("nonEnglishSkipped", 0),
        })
        if not progress_saved:
            raise IngestionLeaseLost("Stale worker could not publish ingestion progress")

        if feed_articles["successfulFeedCount"] > 0:
            cluster_count = rebuild_clusters(lease_owner, fencing_token, job_id, heartbeat.assert_valid, lease_seconds)
        else:
            current = cluster_generation_controls.find_one({"_id": "cluster-lifecycle"}) or {}
            active_id = current.get("activeGenerationId")
            cluster_count = clusters.count_documents({"generationId": active_id}) if active_id else clusters.count_documents({"generationId": {"$in": [None]}})

        heartbeat.assert_valid()
        completed_at = utc_now()
        control = cluster_generation_controls.find_one({"_id": "cluster-lifecycle"}) or {}
        active_generation_id = control.get("activeGenerationId")
        active_generation = cluster_generations.find_one({"generationId": active_generation_id}) if active_generation_id else None
        if active_generation_id and active_generation and not active_generation.get("referenceUpdatesComplete", False):
            raise RuntimeError("Active cluster generation Article reference updates are incomplete")
        if active_generation and active_generation.get("fencingToken") > fencing_token:
            raise IngestionLeaseLost("A newer cluster generation superseded this ingestion")
        if active_generation and active_generation.get("ingestJobId") == job_id:
            cluster_generations.update_one({"generationId": active_generation_id, "fencingToken": fencing_token}, {
                "$set": {"ingestionCompletedAt": completed_at},
            })

        heartbeat.assert_valid()
        completed = mark_job(job_id, lease_owner, fencing_token, {
            "status": "completed",
            "finishedAt": completed_at,
            "clusterGenerationId": active_generation_id,
            "insertedCount": inserted,
            "duplicateCount": duplicates,
            "failedFeedCount": len(feed_articles["failedFeeds"]),
            "failedFeeds": feed_articles["failedFeeds"],
            "successfulFeedCount": feed_articles["successfulFeedCount"],
            "totalStoredCount": total_stored_count,
            "lastSuccessfulCollectionAt": completed_at if feed_articles["successfulFeedCount"] > 0 else None,
            "bodyBackfillCount": body_backfills,
            "clusterCount": cluster_count,
            "nonEnglishSkipped": feed_articles.get("nonEnglishSkipped", 0),
        })
        if not completed:
            raise IngestionLeaseLost("Stale worker could not complete a job owned by another fencing token")
        print(
            f"✅ Ingestion complete: {inserted} new inserted, {duplicates} skipped, "
            f"{len(feed_articles['failedFeeds'])} failed, {cluster_count} clusters rebuilt."
        )
    except Exception as exc:
        current_control = cluster_generation_controls.find_one({
            "_id": "cluster-lifecycle", "leaseOwner": lease_owner, "fencingToken": fencing_token,
            "activeIngestJobId": str(job_id) if job_id else None,
        }) or {}
        active_generation = cluster_generations.find_one({"generationId": current_control.get("activeGenerationId")}) if current_control.get("activeGenerationId") else None
        if active_generation and active_generation.get("ingestJobId") == job_id and not active_generation.get("referenceUpdatesComplete", False):
            mark_job(job_id, lease_owner, fencing_token, {
                "status": "running",
                "recoveryStatus": "GENERATION_ACTIVE_REFERENCE_UPDATES_PENDING",
                "recoveryError": str(exc),
            })
        else:
            mark_job(job_id, lease_owner, fencing_token, {
                "status": "failed",
                "finishedAt": utc_now(),
                "error": str(exc),
            })
        raise
    finally:
        heartbeat.stop()
        if owns_lease:
            cluster_generation_controls.update_one({
                "_id": "cluster-lifecycle", "leaseOwner": lease_owner,
                "fencingToken": fencing_token, "activeIngestJobId": job_id,
            }, {"$unset": {"leaseOwner": "", "leaseExpiresAt": "", "leasePurpose": "", "activeIngestJobId": ""}})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", default=None)
    parser.add_argument("--lease-owner", default=os.getenv("INGESTION_LEASE_OWNER"))
    parser.add_argument("--fencing-token", type=int, default=int(os.getenv("INGESTION_FENCING_TOKEN", "0") or 0))
    parser.add_argument("--lease-seconds", type=int, default=int(os.getenv("INGESTION_LEASE_SECONDS", "120") or 120))
    args = parser.parse_args()
    main(args.job_id, args.lease_owner, args.fencing_token or None, args.lease_seconds)
