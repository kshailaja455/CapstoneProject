const mongoose = require('../backend/node_modules/mongoose');
const fs = require('fs');
const path = require('path');

async function dump() {
  const dest = path.resolve(__dirname, '../data/backup');
  fs.mkdirSync(dest, { recursive: true });
  console.log('Connecting to MongoDB...');
  await mongoose.connect('mongodb://127.0.0.1:27017/news-pulse', {
    serverSelectionTimeoutMS: 4000
  });
  console.log('Connected to MongoDB!');
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    const docs = await mongoose.connection.db.collection(c.name).find({}).toArray();
    fs.writeFileSync(path.join(dest, `${c.name}.json`), JSON.stringify(docs, null, 2));
    console.log(`Backed up ${c.name}: ${docs.length} documents`);
  }
  await mongoose.disconnect();
  console.log('Backup completed successfully.');
}

dump().catch(err => {
  console.error('Backup error:', err.message);
  process.exit(1);
});

