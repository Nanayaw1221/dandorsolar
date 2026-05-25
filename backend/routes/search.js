const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Expense = require('../models/Expense');
const CreditAgreement = require('../models/CreditAgreement');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', async (req, res) => {
  try {
    const { query, modules } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }
    const searchTerm = query.trim();
    const regex = { $regex: searchTerm, $options: 'i' };
    const results = {};
    const searchModules = modules || ['products', 'sales', 'debts', 'expenses', 'credit_agreements'];
    if (searchModules.includes('products')) {
      results.products = await Product.find({ $or: [{ name: regex }, { barcode: regex }] }).populate('category_id', 'name').limit(20);
    }
    if (searchModules.includes('sales')) {
      const salesQuery = { $or: [{ invoice_no: regex }, { customer_name: regex }, { customer_phone: regex }] };
      if (['Sales', 'Manager'].includes(req.user.role)) salesQuery.user_id = req.user._id;
      results.sales = await Sale.find(salesQuery).populate('user_id', 'username').limit(20).sort({ sale_date: -1 });
    }
    if (searchModules.includes('debts') && ['Super Admin', 'CEO', 'Manager'].includes(req.user.role)) {
      results.debts = await Debt.find({ $or: [{ customer_name: regex }, { customer_phone: regex }] }).limit(20).sort({ createdAt: -1 });
    }
    if (searchModules.includes('expenses')) {
      const expenseQuery = { $or: [{ description: regex }, { category: regex }] };
      if (req.user.role === 'Sales') expenseQuery.user_id = req.user._id;
      results.expenses = await Expense.find(expenseQuery).populate('user_id', 'username').limit(20).sort({ expense_date: -1 });
    }
    if (searchModules.includes('credit_agreements') && ['Super Admin', 'CEO', 'Manager'].includes(req.user.role)) {
      results.credit_agreements = await CreditAgreement.find({ $or: [{ customer_name: regex }, { customer_phone: regex }, { guarantor_name: regex }] }).limit(20).sort({ createdAt: -1 });
    }
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    return res.status(200).json({ success: true, data: results, totalResults, query: searchTerm });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Query parameter q must be at least 2 characters' });
    }
    const searchTerm = q.trim();
    const regex = { $regex: searchTerm, $options: 'i' };
    const results = {};
    results.products = await Product.find({ $or: [{ name: regex }, { barcode: regex }] }).populate('category_id', 'name').limit(20);
    const salesQuery = { $or: [{ invoice_no: regex }, { customer_name: regex }, { customer_phone: regex }] };
    if (['Sales', 'Manager'].includes(req.user.role)) salesQuery.user_id = req.user._id;
    results.sales = await Sale.find(salesQuery).populate('user_id', 'username').limit(10).sort({ sale_date: -1 });
    if (['Super Admin', 'CEO', 'Manager'].includes(req.user.role)) {
      results.debts = await Debt.find({ $or: [{ customer_name: regex }, { customer_phone: regex }] }).limit(10);
    }
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    return res.status(200).json({ success: true, data: results, totalResults, query: searchTerm });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
