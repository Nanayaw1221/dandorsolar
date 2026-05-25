const mongoose = require('mongoose');

const creditPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  payment_date: { type: Date, default: Date.now },
  week_number: { type: Number },
  receipt_no: { type: String, trim: true }
}, { _id: true });

const creditItemSchema = new mongoose.Schema({
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit_price: { type: Number, required: true }
}, { _id: false });

const creditAgreementSchema = new mongoose.Schema({
  customer_name: { type: String, required: true, trim: true },
  customer_phone: { type: String, trim: true },
  customer_address: { type: String, trim: true },
  customer_photo: { type: String },
  guarantor_name: { type: String, trim: true },
  guarantor_phone: { type: String, trim: true },
  guarantor_address: { type: String, trim: true },
  total_amount: { type: Number, required: true },
  down_payment: { type: Number, default: 0 },
  remaining: { type: Number, required: true },
  interest_rate: { type: Number, default: 0 },
  start_date: { type: Date },
  end_date: { type: Date },
  status: { type: String, enum: ['active', 'completed', 'defaulted'], default: 'active' },
  payments: [creditPaymentSchema],
  items: [creditItemSchema],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('CreditAgreement', creditAgreementSchema);
