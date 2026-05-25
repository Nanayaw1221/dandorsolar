const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Debt = require('../models/Debt');
const AuditLog = require('../models/AuditLog');

router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ROLE_LEVELS = { 'Sales': 1, 'Manager': 2, 'CEO': 3, 'Super Admin': 4 };
    const userLevel = ROLE_LEVELS[req.user.role] || 1;

    // My stats (all roles)
    const [myTodaySalesAgg, myTodayExpAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { user_id: req.user._id, sale_date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } }
      ]),
      Expense.aggregate([
        { $match: { user_id: req.user._id, expense_date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const data = {
      myTodaySales: myTodaySalesAgg[0]?.total || 0,
      myTodayExpenses: myTodayExpAgg[0]?.total || 0,
    };

    // High-level stats (CEO+ only)
    if (userLevel >= 3) {
      const [todaySalesAgg, monthlySalesAgg, allExpAgg, productCount, lowStockCount, debtAgg] = await Promise.all([
        Sale.aggregate([
          { $match: { sale_date: { $gte: startOfDay, $lte: endOfDay } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        Sale.aggregate([
          { $match: { sale_date: { $gte: startOfMonth, $lte: endOfDay } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        Expense.aggregate([
          { $match: { expense_date: { $gte: startOfDay, $lte: endOfDay } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Product.countDocuments(),
        Product.countDocuments({ $expr: { $lte: ['$quantity', '$low_stock_level'] } }),
        Debt.aggregate([
          { $match: { status: { $in: ['active', 'overdue'] } } },
          { $group: { _id: null, total: { $sum: '$remaining' } } }
        ])
      ]);
      data.todaySales = todaySalesAgg[0]?.total || 0;
      data.monthlySales = monthlySalesAgg[0]?.total || 0;
      data.todayExpenses = allExpAgg[0]?.total || 0;
      data.totalProducts = productCount;
      data.lowStock = lowStockCount;
      data.outstandingDebts = debtAgg[0]?.total || 0;
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/dashboard/sales-chart  (last 7 days)
router.get('/sales-chart', async (req, res) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-GH', { weekday: 'short' }),
      });
    }
    const results = await Promise.all(days.map(async ({ date, day }) => {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59`);
      const agg = await Sale.aggregate([
        { $match: { sale_date: { $gte: start, $lte: end } } },
        { $group: { _id: null, sales: { $sum: '$total_amount' } } }
      ]);
      return { day, date, sales: agg[0]?.sales || 0 };
    }));
    return res.json({ success: true, data: results });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/dashboard/top-products (top 5 by quantity sold)
router.get('/top-products', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const top = await Sale.aggregate([
      { $match: { sale_date: { $gte: startOfMonth } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product_name', sold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' } } },
      { $sort: { sold: -1 } },
      { $limit: 5 },
      { $project: { name: '$_id', sold: 1, revenue: 1, _id: 0 } }
    ]);
    return res.json({ success: true, data: top });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/dashboard/recent-activity
router.get('/recent-activity', async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .select('action module username role timestamp');
    const data = logs.map(l => ({
      type: l.module?.toLowerCase(),
      text: `${l.action} by ${l.username}`,
      time: l.timestamp,
      icon: l.module === 'Sale' ? '💰' : l.module === 'Debt' ? '📋' : l.module === 'Stock' ? '📦' : '🔔',
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
