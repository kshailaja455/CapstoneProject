import pymongo
from datetime import datetime, timezone

from publisherRegistry import ALL_NEW_PUBLISHERS

client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
db = client['news-pulse']
publishers = db['publishers']

print(f"Total publishers to sync: {len(ALL_NEW_PUBLISHERS)}")

inserted = 0
updated = 0

for pub_data in ALL_NEW_PUBLISHERS:
    existing = publishers.find_one({"name": pub_data["name"]})
    if existing:
        # Preserve article count if already tracking
        publishers.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "slug": pub_data["slug"],
                    "homepageUrl": pub_data["homepageUrl"],
                    "description": pub_data["description"],
                    "language": pub_data["language"],
                    "category": pub_data.get("category", "Media"),
                    "country": pub_data.get("country", "Global"),
                    "sourceType": pub_data.get("sourceType", "Media"),
                    "enabled": pub_data["enabled"],
                    "feeds": pub_data["feeds"],
                }
            }
        )
        updated += 1
    else:
        doc = dict(pub_data)
        doc["totalStoredCount"] = 0
        doc["lastIngestionAt"] = None
        doc["createdAt"] = datetime.now(timezone.utc)
        doc["updatedAt"] = datetime.now(timezone.utc)
        publishers.insert_one(doc)
        inserted += 1

print(f"Sync complete: {inserted} inserted, {updated} updated.")
print(f"Total publishers in DB: {publishers.count_documents({})}")
print(f"Total enabled publishers: {publishers.count_documents({'enabled': True})}")

