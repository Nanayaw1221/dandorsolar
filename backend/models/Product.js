const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  barcode: { type: String, index: true, trim: true },
  name: { type: String, required: true, trim: true, index: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  quantity: { type: Number, default: 0, min: 0 },
  cost_price: { type: Number, required: true, min: 0 },
  selling_price: { type: Number, required: true, min: 0 },
  low_stock_level: { type: Number, default: 5, min: 0 },
  image_url: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
