const express = require('express');
const router = express.Router();
const Debt = require('../models/Debt');
const Sale = require('../models/Sale');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO', 'Manager'));

router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [{ customer_name: { $regex: search, $options: 'i' } }, { customer_phone: { $regex: search, $options: 'i' } }];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Debt.countDocuments(query);
    const debts = await Debt.find(query)
      .populate('sale_id', 'invoice_no sale_date')
      .populate('payments.recorded_by', 'username')
      .skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 });
    const totalOwed = await Debt.aggregate([
      { $match: { status: { $in: ['active', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$remaining' } } }
    ]);
    return res.status(200).json({
      success: true, data: debts, totalRemaining: totalOwed[0]?.total || 0,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id)
      .populate('sale_id', 'invoice_no sale_date items')
      .populate('payments.recorded_by', 'username');
    if (!debt) return res.status(404).json({ success: false, message: 'Debt not found' });
    return res.status(200).json({ success: true, data: debt });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:id/payment', async (req, res) => {
  try {
    const { amount, receipt_no } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0' });
    }
    const debt = await Debt.findById(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: 'Debt not found' });
    if (debt.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This debt is already fully paid' });
    }
    if (amount > debt.remaining) {
      return res.status(400).json({ success: false, message: `Payment (${amount}) exceeds remaining debt (${debt.remaining})` });
    }
    const paymentDate = new Date();
    debt.payments.push({ amount, payment_date: paymentDate, receipt_no: receipt_no || `RCP-${Date.now()}`, recorded_by: req.user._id });
    debt.amount_paid += amount;
    debt.remaining = Math.max(0, debt.remaining - amount);
    if (debt.remaining <= 0) debt.status = 'paid';
    await debt.save();
    const dateStr = paymentDate.toISOString().slice(0, 10).replace(/-/g, '');
    const debtInvoiceNo = `DEBT-${dateStr}-${debt._id.toString().slice(-6).toUpperCase()}`;
    await Sale.create({
      invoice_no: debtInvoiceNo, user_id: req.user._id,
      customer_name: debt.customer_name, customer_phone: debt.customer_phone,
      subtotal: amount, discount: 0, discount_type: 'fixed',
      total_amount: amount, cart_total: amount, debt_amount: 0,
      payment_status: 'debt_payment', payment_method: req.body.payment_method || 'cash',
      sale_date: paymentDate, items: []
    });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'DEBT_PAYMENT', module: 'Debts',
      details: { debt_id: debt._id, amount, remaining: debt.remaining, status: debt.status }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    const updatedDebt = await Debt.findById(req.params.id).populate('payments.recorded_by', 'username');
    return res.status(200).json({ success: true, message: 'Payment recorded successfully', data: updatedDebt });
  } catch (error) {
    console.error('Debt payment error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'paid', 'overdue'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const debt = await Debt.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!debt) return res.status(404).json({ success: false, message: 'Debt not found' });
    return res.status(200).json({ success: true, message: 'Status updated', data: debt });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', authorize('Super Admin', 'CEO'), async (req, res) => {
  try {
    const debt = await Debt.findByIdAndDelete(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: 'Debt not found' });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'DELETE_DEBT', module: 'Debts',
      details: { debt_id: req.params.id, customer: debt.customer_name, amount_owed: debt.amount_owed }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Debt record deleted', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
