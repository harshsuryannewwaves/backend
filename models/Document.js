const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
  cloudinaryUrl: String,
  author: String,
  type: String,
  date: Date,
  version: Number,
  history: [
    {
      version: Number,
      filepath: String,
      updatedAt: Date
    }
  ],
  uploadedBy: String
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
