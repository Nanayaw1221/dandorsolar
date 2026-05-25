const express = require('express');
const router = express.Router();
const WorkerPayment = require('../models/WorkerPayment');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO'));

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, page = 1, limit = 50 } = req.query;
    const query = {};
    if (start_date || end_date) {
      query.payment_date = {};
      if (start_date) query.payment_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); query.payment_date.$lte = end; }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await WorkerPayment.countDocuments(query);
    const payments = await WorkerPayment.find(query).populate('created_by', 'username').skip(skip).limit(parseInt(limit)).sort({ payment_date: -1 });
    return res.status(200).json({
      success: true, data: payments,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await WorkerPayment.findById(req.params.id).populate('created_by', 'username');
    if (!payment) return res.status(404).json({ success: false, message: 'Worker payment not found' });
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { worker_name, worker_phone, commission_rate, amount_paid, payment_date, period_start, period_end, notes } = req.body;
    if (!worker_name || amount_paid === undefined) {
      return res.status(400).json({ success: false, message: 'worker_name and amount_paid are required' });
    }
    const payDate = payment_date ? new Date(payment_date) : new Date();
    const workerPayment = await WorkerPayment.create({
      worker_name, worker_phone, commission_rate: commission_rate || 0, amount_paid,
      payment_date: payDate,
      period_start: period_start ? new Date(period_start) : undefined,
      period_end: period_end ? new Date(period_end) : undefined,
      notes, created_by: req.user._id
    });
    const expense = await Expense.create({
      user_id: req.user._id, category: 'Salaries', amount: amount_paid,
      description: `Worker payment to ${worker_name}${notes ? ' - ' + notes : ''}`,
      expense_date: payDate
    });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_WORKER_PAYMENT', module: 'WorkerPayments',
      details: { worker_name, amount_paid }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(201).json({ success: true, message: 'Worker payment created and expense recorded', data: { workerPayment, expense } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const payment = await WorkerPayment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Worker payment not found' });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'DELETE_WORKER_PAYMENT', module: 'WorkerPayments',
      details: { worker_name: payment.worker_name, amount: payment.amount_paid }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Worker payment deleted', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
