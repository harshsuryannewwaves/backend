const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: String,
  user: String,
  timestamp: { type: Date, default: Date.now },
  details: String
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
