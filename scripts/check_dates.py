import pymongo
from datetime import datetime, timezone

client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
db = client['news-pulse']

print('--- ALL DISTINCT DATES IN fetchedAt ---')
dates = set()
for a in db.articles.find({}, {'fetchedAt': 1}):
    f = a.get('fetchedAt')
    if f:
        dates.add(str(f)[:10])
print('fetchedAt dates:', sorted(list(dates)))

print('\n--- ALL DISTINCT DATES IN publishedAt ---')
p_dates = set()
for a in db.articles.find({}, {'publishedAt': 1}):
    p = a.get('publishedAt')
    if p:
        p_dates.add(str(p)[:10])
print('publishedAt dates:', sorted(list(p_dates)))

print('\n--- RECENT JOBS ---')
for j in db.jobs.find().sort('startedAt', -1).limit(5):
    print(j)

