const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO'));

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, supplier_id, page = 1, limit = 50 } = req.query;
    const query = {};
    if (start_date || end_date) {
      query.purchase_date = {};
      if (start_date) query.purchase_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); query.purchase_date.$lte = end; }
    }
    if (supplier_id) query.supplier_id = supplier_id;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier_id', 'name phone').populate('created_by', 'username')
      .skip(skip).limit(parseInt(limit)).sort({ purchase_date: -1 });
    return res.status(200).json({
      success: true, data: purchases,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier_id', 'name phone address email').populate('created_by', 'username');
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    return res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { supplier_id, invoice_no, purchase_date, notes, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }
    let totalAmount = 0;
    const purchaseItems = [];
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.cost_price) {
        return res.status(400).json({ success: false, message: 'Each item needs product_id, quantity, and cost_price' });
      }
      const product = await Product.findById(item.product_id);
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.product_id} not found` });
      const itemTotal = item.quantity * item.cost_price;
      totalAmount += itemTotal;
      purchaseItems.push({ product_id: product._id, product_name: product.name, quantity: item.quantity, cost_price: item.cost_price, total: itemTotal });
    }
    const purchase = await Purchase.create({
      supplier_id, invoice_no, purchase_date: purchase_date ? new Date(purchase_date) : new Date(),
      total_amount: totalAmount, notes, created_by: req.user._id, items: purchaseItems
    });
    for (const item of purchaseItems) {
      await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: item.quantity }, $set: { cost_price: item.cost_price } });
    }
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_PURCHASE', module: 'Purchases',
      details: { purchase_id: purchase._id, total_amount: totalAmount, items: purchaseItems.length }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    const populatedPurchase = await Purchase.findById(purchase._id).populate('supplier_id', 'name').populate('created_by', 'username');
    return res.status(201).json({ success: true, message: 'Purchase created and stock updated', data: populatedPurchase });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', authorize('Super Admin'), async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    for (const item of purchase.items) {
      await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: -item.quantity } });
    }
    await Purchase.findByIdAndDelete(req.params.id);
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'DELETE_PURCHASE', module: 'Purchases',
      details: { purchase_id: req.params.id, total_amount: purchase.total_amount }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Purchase deleted and stock reversed', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
