const mongoose = require('mongoose');

const emailQueueSchema = new mongoose.Schema({
  to_email: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  priority: { type: String, enum: ['critical', 'high', 'normal'], default: 'normal' },
  sent_at: { type: Date },
  retry_count: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  error_message: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('EmailQueue', emailQueueSchema);
