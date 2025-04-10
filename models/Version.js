const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  version: Number,
  filename: String,
  filepath: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Version', versionSchema);
