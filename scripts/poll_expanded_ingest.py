import pymongo
import time
from bson import ObjectId

client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
db = client['news-pulse']

job_id = ObjectId('6b0154f44f40f56509c10c29')

for i in range(25):
    j = db.ingestjobs.find_one({'_id': job_id})
    status = j.get('status') if j else None
    if status and status != 'running':
        print('Job completed!')
        print('Status:', status)
        print('Inserted:', j.get('insertedCount'))
        print('Duplicates:', j.get('duplicateCount'))
        print('Successful feeds:', j.get('successfulFeedCount'))
        print('Failed feeds count:', j.get('failedFeedCount'))
        print('Failed feeds details:', j.get('failedFeeds'))
        print('Clusters:', j.get('clusterCount'))
        print('Total articles in DB:', db.articles.count_documents({}))
        break
    print(f"Waiting... ({i*4}s) status: {status}")
    time.sleep(4)

