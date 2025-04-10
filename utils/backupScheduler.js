const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const mongoose = require('mongoose');

const backupPath = process.env.BACKUP_PATH || './backup';

if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath);
}

const backupDatabase = async () => {
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupPath, `backup-${date}.json`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    const data = {};

    for (const coll of collections) {
        const docs = await mongoose.connection.db.collection(coll.name).find({}).toArray();
        data[coll.name] = docs;
    }

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    
};

module.exports = cron.schedule('0 * * * *', backupDatabase); // every hour
