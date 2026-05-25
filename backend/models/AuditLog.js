const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  role: String,
  action: { type: String, required: true },
  module: String,
  details: { type: mongoose.Schema.Types.Mixed },
  ip_address: String,
  timestamp: { type: Date, default: Date.now }
});

auditLogSchema.index({ user_id: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ module: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
