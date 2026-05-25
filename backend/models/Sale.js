const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit_price: { type: Number, required: true },
  cost_price: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  invoice_no: { type: String, required: true, unique: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer_name: { type: String, trim: true },
  customer_phone: { type: String, trim: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  discount_type: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  total_amount: { type: Number, required: true },
  cart_total: { type: Number, required: true },
  debt_amount: { type: Number, default: 0 },
  payment_status: { type: String, enum: ['paid', 'partial', 'debt_payment'], required: true },
  payment_method: { type: String, enum: ['cash', 'card', 'mobile_money'], required: true },
  sale_date: { type: Date, default: Date.now },
  items: [saleItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
