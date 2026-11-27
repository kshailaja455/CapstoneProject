import pymongo

client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
db = client['news-pulse']

print('Sample clusters with multiple articles:')
multi = list(db.clusters.find({'articleCount': {'$gt': 1}}).sort('articleCount', -1).limit(6))
for c in multi:
    print(f"Label: {c.get('label')}")
    print(f"  Count: {c.get('articleCount')} | Sources: {c.get('sources')}")
    print(f"  Top terms: {c.get('topTerms')}")

