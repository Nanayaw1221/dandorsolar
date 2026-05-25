const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);
const canManage = authorize('Super Admin', 'CEO');

router.get('/', async (req, res) => {
  try {
    const { search, category_id, page = 1, limit = 50, low_stock } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }
    if (category_id) query.category_id = category_id;
    if (low_stock === 'true') {
      query.$expr = { $lte: ['$quantity', '$low_stock_level'] };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category_id', 'name')
      .populate('supplier_id', 'name phone')
      .skip(skip).limit(parseInt(limit)).sort({ name: 1 });
    return res.status(200).json({
      success: true, data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POS search alias: GET /products/search?q=...
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = parseInt(req.query.limit) || 10;
    if (!q.trim()) return res.json({ success: true, data: [] });
    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { barcode: { $regex: q, $options: 'i' } }
      ],
      quantity: { $gt: 0 }
    }).populate('category_id', 'name').limit(limit).sort({ name: 1 });
    return res.json({ success: true, data: products });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const products = await Product.find({ $expr: { $lte: ['$quantity', '$low_stock_level'] } })
      .populate('category_id', 'name').populate('supplier_id', 'name phone').sort({ quantity: 1 });
    return res.status(200).json({ success: true, data: products, count: products.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/barcode/:barcode', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode })
      .populate('category_id', 'name').populate('supplier_id', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category_id', 'name').populate('supplier_id', 'name phone');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', canManage, auditLog('CREATE_PRODUCT', 'Products'), async (req, res) => {
  try {
    const { barcode, name, category_id, supplier_id, quantity, cost_price, selling_price, low_stock_level, image_url } = req.body;
    if (!name || cost_price === undefined || selling_price === undefined) {
      return res.status(400).json({ success: false, message: 'name, cost_price and selling_price are required' });
    }
    if (barcode) {
      const existing = await Product.findOne({ barcode });
      if (existing) return res.status(409).json({ success: false, message: 'Barcode already exists' });
    }
    const product = await Product.create({
      barcode, name, category_id, supplier_id,
      quantity: quantity || 0, cost_price, selling_price,
      low_stock_level: low_stock_level || 5, image_url
    });
    return res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Barcode already exists' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', canManage, auditLog('UPDATE_PRODUCT', 'Products'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('category_id', 'name').populate('supplier_id', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.status(200).json({ success: true, message: 'Product updated successfully', data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', canManage, auditLog('DELETE_PRODUCT', 'Products'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.status(200).json({ success: true, message: 'Product deleted successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
