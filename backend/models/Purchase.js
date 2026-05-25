const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  cost_price: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  invoice_no: { type: String, trim: true },
  purchase_date: { type: Date, default: Date.now },
  total_amount: { type: Number, required: true },
  notes: { type: String, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [purchaseItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
