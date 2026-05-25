const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Debt = require('../models/Debt');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');
const { generateInvoiceNo } = require('../utils/invoiceGenerator');

router.use(protect);

router.get('/stats/today', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const query = { sale_date: { $gte: startOfDay, $lte: endOfDay } };
    if (['Sales', 'Manager'].includes(req.user.role)) query.user_id = req.user._id;
    const sales = await Sale.find(query);
    const totalSales = sales.length;
    const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const paidSales = sales.filter(s => s.payment_status === 'paid').length;
    const partialSales = sales.filter(s => s.payment_status === 'partial').length;
    const debtPayments = sales.filter(s => s.payment_status === 'debt_payment').length;
    return res.status(200).json({
      success: true,
      data: { totalSales, totalAmount, paidSales, partialSales, debtPayments, date: today.toISOString().split('T')[0] }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/stats/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const now = new Date();
    const y = parseInt(year) || now.getFullYear();
    const m = parseInt(month) || now.getMonth() + 1;
    const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59);
    const query = { sale_date: { $gte: startOfMonth, $lte: endOfMonth } };
    if (['Sales', 'Manager'].includes(req.user.role)) query.user_id = req.user._id;
    const sales = await Sale.find(query);
    const totalSales = sales.length;
    const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const dailyBreakdown = {};
    sales.forEach(s => {
      const day = new Date(s.sale_date).toISOString().split('T')[0];
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { count: 0, amount: 0 };
      dailyBreakdown[day].count++;
      dailyBreakdown[day].amount += s.total_amount;
    });
    return res.status(200).json({ success: true, data: { year: y, month: m, totalSales, totalAmount, dailyBreakdown } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, payment_status, payment_method, page = 1, limit = 50 } = req.query;
    const query = {};
    if (['Sales', 'Manager'].includes(req.user.role)) query.user_id = req.user._id;
    if (start_date || end_date) {
      query.sale_date = {};
      if (start_date) query.sale_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); query.sale_date.$lte = end; }
    }
    if (payment_status) query.payment_status = payment_status;
    if (payment_method) query.payment_method = payment_method;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('user_id', 'username role')
      .skip(skip).limit(parseInt(limit)).sort({ sale_date: -1 });
    return res.status(200).json({
      success: true, data: sales,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('user_id', 'username role');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    if (['Sales', 'Manager'].includes(req.user.role) && sale.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.status(200).json({ success: true, data: sale });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/pos', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customer_name, customer_phone, items, discount = 0, discount_type = 'fixed',
      payment_method, payment_status, total_amount, due_date } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Items are required' });
    }
    if (!payment_method) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'payment_method is required' });
    }
    if (!payment_status) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'payment_status is required' });
    }
    const saleItems = [];
    let subtotal = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity < 1) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Each item needs product_id and quantity >= 1' });
      }
      const product = await Product.findById(item.product_id).session(session);
      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: `Product ${item.product_id} not found` });
      }
      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
      }
      const unit_price = item.unit_price || product.selling_price;
      const itemTotal = unit_price * item.quantity;
      subtotal += itemTotal;
      saleItems.push({
        product_id: product._id, product_name: product.name,
        quantity: item.quantity, unit_price, cost_price: product.cost_price, total: itemTotal
      });
    }
    let cartTotal = subtotal;
    if (discount > 0) {
      if (discount_type === 'percentage') cartTotal = subtotal - (subtotal * discount / 100);
      else cartTotal = subtotal - discount;
    }
    cartTotal = Math.max(0, cartTotal);
    const amountPaid = payment_status === 'partial' ? (total_amount || 0) : cartTotal;
    const debtAmount = payment_status === 'partial' ? cartTotal - amountPaid : 0;
    if (payment_status === 'partial' && amountPaid >= cartTotal) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'For partial payment, amount paid must be less than cart total' });
    }
    const invoice_no = await generateInvoiceNo();
    const [sale] = await Sale.create([{
      invoice_no, user_id: req.user._id, customer_name, customer_phone,
      subtotal, discount, discount_type, total_amount: amountPaid, cart_total: cartTotal,
      debt_amount: debtAmount, payment_status, payment_method, sale_date: new Date(), items: saleItems
    }], { session });
    for (const item of saleItems) {
      await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: -item.quantity } }, { session });
    }
    let debt = null;
    if (payment_status === 'partial') {
      [debt] = await Debt.create([{
        sale_id: sale._id, customer_name: customer_name || 'Unknown', customer_phone,
        amount_owed: cartTotal, amount_paid: amountPaid, remaining: debtAmount,
        due_date: due_date ? new Date(due_date) : null, status: 'active',
        payments: amountPaid > 0 ? [{ amount: amountPaid, payment_date: new Date(), receipt_no: invoice_no, recorded_by: req.user._id }] : []
      }], { session });
    }
    await session.commitTransaction();
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_SALE', module: 'Sales',
      details: { invoice_no, total_amount: amountPaid, items: saleItems.length }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(201).json({ success: true, message: 'Sale created successfully', data: { sale, debt } });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create sale error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
});

module.exports = router;
