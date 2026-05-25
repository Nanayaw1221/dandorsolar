const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Debt = require('../models/Debt');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO'));

router.get('/daily-sales', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
    const sales = await Sale.find({ sale_date: { $gte: start, $lte: end } }).populate('user_id', 'username role');
    const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const byUser = {};
    sales.forEach(s => {
      const uid = s.user_id?._id?.toString() || 'unknown';
      const uname = s.user_id?.username || 'Unknown';
      if (!byUser[uid]) byUser[uid] = { username: uname, count: 0, total: 0 };
      byUser[uid].count++;
      byUser[uid].total += s.total_amount;
    });
    const byMethod = {};
    sales.forEach(s => {
      if (!byMethod[s.payment_method]) byMethod[s.payment_method] = { count: 0, total: 0 };
      byMethod[s.payment_method].count++;
      byMethod[s.payment_method].total += s.total_amount;
    });
    return res.status(200).json({
      success: true,
      data: { date: targetDate.toISOString().split('T')[0], totalSales: sales.length, totalAmount, byUser: Object.values(byUser), byPaymentMethod: byMethod, sales }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/profit-loss', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date ? new Date(start_date) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = end_date ? new Date(end_date) : new Date();
    if (end_date) end.setHours(23, 59, 59, 999);
    const sales = await Sale.find({ sale_date: { $gte: start, $lte: end }, payment_status: { $ne: 'debt_payment' } });
    const totalRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
    let totalCOGS = 0;
    sales.forEach(s => { s.items.forEach(item => { totalCOGS += item.cost_price * item.quantity; }); });
    const grossProfit = totalRevenue - totalCOGS;
    const expenses = await Expense.find({ expense_date: { $gte: start, $lte: end } });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expensesByCategory = {};
    expenses.forEach(e => { if (!expensesByCategory[e.category]) expensesByCategory[e.category] = 0; expensesByCategory[e.category] += e.amount; });
    const netProfit = grossProfit - totalExpenses;
    return res.status(200).json({
      success: true,
      data: {
        period: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
        revenue: { totalSales: sales.length, totalRevenue },
        cogs: totalCOGS, grossProfit,
        grossMargin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%',
        expenses: { total: totalExpenses, byCategory: expensesByCategory },
        netProfit, netMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/stock-valuation', async (req, res) => {
  try {
    const products = await Product.find().populate('category_id', 'name');
    let totalCostValue = 0, totalSellingValue = 0, totalItems = 0;
    const items = products.map(p => {
      const costValue = p.quantity * p.cost_price;
      const sellingValue = p.quantity * p.selling_price;
      totalCostValue += costValue; totalSellingValue += sellingValue; totalItems += p.quantity;
      return { _id: p._id, name: p.name, category: p.category_id?.name || 'Uncategorized', quantity: p.quantity, cost_price: p.cost_price, selling_price: p.selling_price, costValue, sellingValue, potentialProfit: sellingValue - costValue };
    });
    return res.status(200).json({
      success: true,
      data: { summary: { totalProducts: products.length, totalItems, totalCostValue, totalSellingValue, potentialProfit: totalSellingValue - totalCostValue }, items }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/debtors', async (req, res) => {
  try {
    const debts = await Debt.find({ status: { $in: ['active', 'overdue'] } }).populate('sale_id', 'invoice_no sale_date').sort({ remaining: -1 });
    const totalOwed = debts.reduce((sum, d) => sum + d.remaining, 0);
    const overdueDebts = debts.filter(d => d.status === 'overdue');
    return res.status(200).json({
      success: true,
      data: { summary: { totalDebtors: debts.length, totalOwed, overdueCount: overdueDebts.length, overdueAmount: overdueDebts.reduce((sum, d) => sum + d.remaining, 0) }, debtors: debts }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const query = {};
    if (start_date || end_date) {
      query.expense_date = {};
      if (start_date) query.expense_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); query.expense_date.$lte = end; }
    }
    const expenses = await Expense.find(query).populate('user_id', 'username role').sort({ expense_date: -1 });
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = {};
    expenses.forEach(e => { if (!byCategory[e.category]) byCategory[e.category] = { count: 0, total: 0 }; byCategory[e.category].count++; byCategory[e.category].total += e.amount; });
    return res.status(200).json({ success: true, data: { summary: { totalExpenses: expenses.length, totalAmount: total }, byCategory, expenses } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/top-products', async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;
    const matchQuery = { payment_status: { $ne: 'debt_payment' } };
    if (start_date || end_date) {
      matchQuery.sale_date = {};
      if (start_date) matchQuery.sale_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); matchQuery.sale_date.$lte = end; }
    }
    const topProducts = await Sale.aggregate([
      { $match: matchQuery }, { $unwind: '$items' },
      { $group: { _id: '$items.product_id', product_name: { $first: '$items.product_name' }, totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' }, totalCost: { $sum: { $multiply: ['$items.cost_price', '$items.quantity'] } }, transactionCount: { $sum: 1 } } },
      { $addFields: { profit: { $subtract: ['$totalRevenue', '$totalCost'] } } },
      { $sort: { totalQuantity: -1 } }, { $limit: parseInt(limit) }
    ]);
    return res.status(200).json({ success: true, data: topProducts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/sales-by-user', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const matchQuery = {};
    if (start_date || end_date) {
      matchQuery.sale_date = {};
      if (start_date) matchQuery.sale_date.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); matchQuery.sale_date.$lte = end; }
    }
    const salesByUser = await Sale.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$user_id', totalSales: { $sum: 1 }, totalAmount: { $sum: '$total_amount' }, totalCartValue: { $sum: '$cart_total' }, paidSales: { $sum: { $cond: [{ $eq: ['$payment_status', 'paid'] }, 1, 0] } }, partialSales: { $sum: { $cond: [{ $eq: ['$payment_status', 'partial'] }, 1, 0] } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $addFields: { username: { $arrayElemAt: ['$user.username', 0] }, role: { $arrayElemAt: ['$user.role', 0] } } },
      { $project: { user: 0 } }, { $sort: { totalAmount: -1 } }
    ]);
    return res.status(200).json({ success: true, data: salesByUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
