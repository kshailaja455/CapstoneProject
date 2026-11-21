import pymongo
from datetime import datetime, timezone
client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
db = client['news-pulse']

print('--- JOBS COLLECTION (last 15 jobs) ---')
jobs = list(db.jobs.find().sort('startedAt', -1).limit(15))
for j in jobs:
    print(f"ID: {j.get('_id')} | Status: {j.get('status')} | Started: {j.get('startedAt')} | Finished: {j.get('finishedAt')} | Inserted: {j.get('insertedCount')} | Dups: {j.get('duplicateCount')} | Triggered: {j.get('triggeredBy')}")

print('\n--- PUBLISHERS ---')
pubs = list(db.publishers.find())
for p in pubs:
    feeds = p.get('feeds', [])
    print(f"Pub: {p.get('name')} | LastIngest: {p.get('lastIngestionAt')} | Stored: {p.get('totalStoredCount')} | Feeds: {len(feeds)}")
    for f in feeds:
        print(f"   Feed: {f.get('url')} | LastStatus: {f.get('lastStatus')} | LastFetched: {f.get('lastFetchedAt')} | LastErr: {f.get('lastError')}")

print('\n--- ARTICLES INGESTION TIMESTAMPS (Grouped by fetchedAt / discoveredAt) ---')
pipeline = [
    {'$group': {'_id': {'$substr': ['$fetchedAt', 0, 16]}, 'count': {'$sum': 1}}},
    {'$sort': {'_id': -1}},
    {'$limit': 15}
]
res = list(db.articles.aggregate(pipeline))
for r in res:
    print(f"Time: {r['_id']} -> count: {r['count']}")

print('\n--- LATEST 5 ARTICLES ---')
arts = list(db.articles.find().sort('fetchedAt', -1).limit(5))
for a in arts:
    print(f"Title: {a.get('title')[:40]} | Pub: {a.get('source')} | PublishedAt: {a.get('publishedAt')} | FetchedAt: {a.get('fetchedAt')} | DiscoveredAt: {a.get('discoveredAt')}")

