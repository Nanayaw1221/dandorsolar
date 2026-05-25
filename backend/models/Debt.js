const mongoose = require('mongoose');

const debtPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  payment_date: { type: Date, default: Date.now },
  receipt_no: { type: String },
  recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const debtSchema = new mongoose.Schema({
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  customer_name: { type: String, required: true, trim: true },
  customer_phone: { type: String, trim: true },
  amount_owed: { type: Number, required: true },
  amount_paid: { type: Number, default: 0 },
  remaining: { type: Number, required: true },
  due_date: { type: Date },
  status: { type: String, enum: ['active', 'paid', 'overdue'], default: 'active' },
  payments: [debtPaymentSchema]
}, { timestamps: true });

module.exports = mongoose.model('Debt', debtSchema);
