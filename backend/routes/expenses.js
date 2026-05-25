const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, category, page = 1, limit = 50 } = req.query;
    const query = {};
    if (req.user.role === 'Sales') query.user_id = req.user._id;
    if (start_date || end_date) {
      query.expense_date = {};
      if (start_date) query.expense_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); query.expense_date.$lte = end; }
    }
    if (category) query.category = category;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query).populate('user_id', 'username role').skip(skip).limit(parseInt(limit)).sort({ expense_date: -1 });
    const totalAgg = await Expense.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    return res.status(200).json({
      success: true, data: expenses, totalAmount: totalAgg[0]?.total || 0,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { category, amount, description, expense_date } = req.body;
    if (!category || amount === undefined) {
      return res.status(400).json({ success: false, message: 'category and amount are required' });
    }
    const validCategories = ['Rent', 'Utilities', 'Transport', 'Salaries', 'Maintenance', 'Marketing', 'Other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }
    const expense = await Expense.create({
      user_id: req.user._id, category, amount, description,
      expense_date: expense_date ? new Date(expense_date) : new Date()
    });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_EXPENSE', module: 'Expenses',
      details: { category, amount }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(201).json({ success: true, message: 'Expense created successfully', data: expense });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate('user_id', 'username role');
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (req.user.role === 'Sales' && expense.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.status(200).json({ success: true, data: expense });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (req.user.role === 'Sales' && expense.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { category, amount, description, expense_date } = req.body;
    const updateData = {};
    if (category) updateData.category = category;
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (expense_date) updateData.expense_date = new Date(expense_date);
    const updatedExpense = await Expense.findByIdAndUpdate(req.params.id, updateData, { new: true });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'UPDATE_EXPENSE', module: 'Expenses',
      details: { expense_id: req.params.id, changes: updateData }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Expense updated successfully', data: updatedExpense });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', authorize('Super Admin', 'CEO'), async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'DELETE_EXPENSE', module: 'Expenses',
      details: { expense_id: req.params.id, amount: expense.amount, category: expense.category }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Expense deleted successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
