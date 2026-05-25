const mongoose = require('mongoose');

const workerPaymentSchema = new mongoose.Schema({
  worker_name: { type: String, required: true, trim: true },
  worker_phone: { type: String, trim: true },
  commission_rate: { type: Number, default: 0 },
  amount_paid: { type: Number, required: true, min: 0 },
  payment_date: { type: Date, required: true, default: Date.now },
  period_start: { type: Date },
  period_end: { type: Date },
  notes: { type: String, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('WorkerPayment', workerPaymentSchema);
