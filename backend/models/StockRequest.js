const mongoose = require('mongoose');

const stockRequestItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String, required: true },
  quantity_requested: { type: Number, required: true, min: 1 },
  estimated_cost: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const stockRequestSchema = new mongoose.Schema({
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  request_date: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_date: { type: Date },
  rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejection_reason: { type: String, trim: true },
  total_amount: { type: Number, default: 0 },
  notes: { type: String, trim: true },
  items: [stockRequestItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('StockRequest', stockRequestSchema);
