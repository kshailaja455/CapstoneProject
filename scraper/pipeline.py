from datetime import datetime, timezone
import argparse
import hashlib

from bson import ObjectId
from pymongo import UpdateOne

from clustering.tfidf import cluster_articles
from config import MAX_ARTICLES_FOR_CLUSTERING
from database.mongo import articles, clusters, jobs, db
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


def persist_articles(feed_articles):
    operations = []
    seen_urls = set()
    duplicates = 0
    body_backfills = 0

    for article in feed_articles:
        url = article["url"]
        if url in seen_urls:
            duplicates += 1
            continue
        seen_urls.add(url)

        existing = articles.find_one({"url": url}, {"_id": 1, "body": 1})
        if existing:
            duplicates += 1
            if not existing.get("body"):
                normalized = normalize_article(article)
                articles.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "body": normalized["body"],
                        "summary": normalized["summary"],
                        "contentHash": normalized["contentHash"],
                        "fetchedAt": normalized["fetchedAt"],
                        "processingStatus": "processed",
                    }},
                )
                body_backfills += 1
            continue

        normalized = normalize_article(article)
        operations.append(UpdateOne(
            {"url": normalized["url"]},
            {"$setOnInsert": normalized},
            upsert=True,
        ))

    inserted = 0
    if operations:
        result = articles.bulk_write(operations, ordered=False)
        inserted = result.upserted_count
        duplicates += len(operations) - inserted

    return inserted, duplicates, body_backfills


def rebuild_clusters():
    recent_articles = list(
        articles
        .find({})
        .sort("publishedAt", -1)
        .limit(MAX_ARTICLES_FOR_CLUSTERING)
    )

    if not recent_articles:
        return 0

    generated_clusters = cluster_articles(recent_articles)
    # Only reset status for articles being re-clustered (not all articles)
    recent_ids = [a["_id"] for a in recent_articles]
    clusters.delete_many({})
    articles.update_many(
        {"_id": {"$in": recent_ids}},
        {"$set": {"clusterId": None, "processingStatus": "processing"}},
    )
    created = 0

    for generated in generated_clusters:
        members = [recent_articles[index] for index in generated["articleIndexes"]]
        article_ids = [member["_id"] for member in members]
        published_times = [
            member.get("publishedAt") or member.get("fetchedAt") or utc_now()
            for member in members
        ]

        cluster_doc = {
            "label": generated["label"],
            "topTerms": generated["topTerms"],
            "articleIds": article_ids,
            "sources": sorted({member.get("source", "Unknown") for member in members}),
            "articleCount": len(members),
            "startTime": min(published_times),
            "endTime": max(published_times),
            "representativeArticleId": article_ids[0],
            "createdAt": utc_now(),
            "updatedAt": utc_now(),
        }

        result = clusters.insert_one(cluster_doc)
        articles.update_many(
            {"_id": {"$in": article_ids}},
            {"$set": {
                "clusterId": result.inserted_id,
                "processingStatus": "clustered",
            }},
        )
        created += 1

    return created


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


def mark_job(job_id, update):
    if not job_id:
        return
    jobs.update_one({"_id": ObjectId(job_id)}, {"$set": update})


def main(job_id=None):
    mark_job(job_id, {"status": "running", "startedAt": utc_now(), "error": None})

    try:
        feed_articles = fetch_articles()
        inserted, duplicates, body_backfills = persist_articles(feed_articles["articles"])

        cluster_count = (
            rebuild_clusters()
            if feed_articles["successfulFeedCount"] > 0
            else clusters.count_documents({})
        )

        update_publisher_metrics(feed_articles.get("feedResults", []))

        total_stored_count = articles.count_documents({})
        completed_at = utc_now()

        mark_job(job_id, {
            "status": "completed",
            "finishedAt": completed_at,
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
        print(
            f"✅ Ingestion complete: {inserted} new inserted, {duplicates} skipped, "
            f"{len(feed_articles['failedFeeds'])} failed, {cluster_count} clusters rebuilt."
        )
    except Exception as exc:
        mark_job(job_id, {
            "status": "failed",
            "finishedAt": utc_now(),
            "error": str(exc),
        })
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", default=None)
    args = parser.parse_args()
    main(args.job_id)
