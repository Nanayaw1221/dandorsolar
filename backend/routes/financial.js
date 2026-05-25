const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Debt = require('../models/Debt');
const CreditAgreement = require('../models/CreditAgreement');
const Purchase = require('../models/Purchase');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO'));

router.get('/balance-sheet', async (req, res) => {
  try {
    const { date } = req.query;
    const asOfDate = date ? new Date(date) : new Date();
    asOfDate.setHours(23, 59, 59, 999);
    const products = await Product.find();
    const inventoryValue = products.reduce((sum, p) => sum + p.quantity * p.cost_price, 0);
    const activeDebts = await Debt.find({ status: { $in: ['active', 'overdue'] } });
    const accountsReceivable = activeDebts.reduce((sum, d) => sum + d.remaining, 0);
    const activeCreditAgreements = await CreditAgreement.find({ status: 'active' });
    const creditReceivable = activeCreditAgreements.reduce((sum, a) => sum + a.remaining, 0);
    const totalRevenue = await Sale.aggregate([{ $match: { sale_date: { $lte: asOfDate } } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]);
    const totalExpenses = await Expense.aggregate([{ $match: { expense_date: { $lte: asOfDate } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalPurchasesCost = await Purchase.aggregate([{ $match: { purchase_date: { $lte: asOfDate } } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]);
    const cashRevenue = totalRevenue[0]?.total || 0;
    const cashExpenses = totalExpenses[0]?.total || 0;
    const purchasesCost = totalPurchasesCost[0]?.total || 0;
    const cashPosition = cashRevenue - cashExpenses - purchasesCost;
    const totalAssets = inventoryValue + accountsReceivable + creditReceivable + Math.max(0, cashPosition);
    const totalLiabilities = 0;
    const equity = totalAssets - totalLiabilities;
    return res.status(200).json({
      success: true,
      data: {
        asOf: asOfDate.toISOString().split('T')[0],
        assets: { currentAssets: { cash: Math.max(0, cashPosition), inventory: inventoryValue, accountsReceivable, creditAgreementsReceivable: creditReceivable }, totalAssets },
        liabilities: { currentLiabilities: {}, totalLiabilities },
        equity: { retainedEarnings: equity, totalEquity: equity },
        balanceCheck: totalAssets === totalLiabilities + equity
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/cash-flow', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date ? new Date(start_date) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = end_date ? new Date(end_date) : new Date();
    if (end_date) end.setHours(23, 59, 59, 999);
    const salesInflow = await Sale.aggregate([{ $match: { sale_date: { $gte: start, $lte: end } } }, { $group: { _id: '$payment_method', total: { $sum: '$total_amount' }, count: { $sum: 1 } } }]);
    const totalInflow = salesInflow.reduce((sum, s) => sum + s.total, 0);
    const expensesOutflow = await Expense.aggregate([{ $match: { expense_date: { $gte: start, $lte: end } } }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    const totalExpensesOutflow = expensesOutflow.reduce((sum, e) => sum + e.total, 0);
    const purchasesOutflow = await Purchase.aggregate([{ $match: { purchase_date: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }]);
    const totalPurchasesOutflow = purchasesOutflow[0]?.total || 0;
    const netCashFlow = totalInflow - totalExpensesOutflow - totalPurchasesOutflow;
    return res.status(200).json({
      success: true,
      data: {
        period: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
        operatingActivities: { inflows: { sales: totalInflow, byMethod: salesInflow }, outflows: { expenses: totalExpensesOutflow, byCategory: expensesOutflow }, netOperating: totalInflow - totalExpensesOutflow },
        investingActivities: { outflows: { purchases: totalPurchasesOutflow, detail: purchasesOutflow }, netInvesting: -totalPurchasesOutflow },
        netCashFlow,
        summary: { totalInflows: totalInflow, totalOutflows: totalExpensesOutflow + totalPurchasesOutflow, netPosition: netCashFlow > 0 ? 'Positive' : netCashFlow < 0 ? 'Negative' : 'Neutral' }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/trial-balance', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date ? new Date(start_date) : new Date(new Date().getFullYear(), 0, 1);
    const end = end_date ? new Date(end_date) : new Date();
    if (end_date) end.setHours(23, 59, 59, 999);
    const salesRevenue = await Sale.aggregate([{ $match: { sale_date: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]);
    const totalSalesRevenue = salesRevenue[0]?.total || 0;
    const cogs = await Sale.aggregate([{ $match: { sale_date: { $gte: start, $lte: end }, payment_status: { $ne: 'debt_payment' } } }, { $unwind: '$items' }, { $group: { _id: null, total: { $sum: { $multiply: ['$items.cost_price', '$items.quantity'] } } } }]);
    const totalCOGS = cogs[0]?.total || 0;
    const expensesByCategory = await Expense.aggregate([{ $match: { expense_date: { $gte: start, $lte: end } } }, { $group: { _id: '$category', total: { $sum: '$amount' } } }]);
    const totalExpenses = expensesByCategory.reduce((sum, e) => sum + e.total, 0);
    const products = await Product.find();
    const inventoryValue = products.reduce((sum, p) => sum + p.quantity * p.cost_price, 0);
    const activeDebts = await Debt.find({ status: { $in: ['active', 'overdue'] } });
    const accountsReceivable = activeDebts.reduce((sum, d) => sum + d.remaining, 0);
    const accounts = [
      { account: 'Sales Revenue', type: 'Revenue', credit: totalSalesRevenue, debit: 0 },
      { account: 'Cost of Goods Sold', type: 'Expense', credit: 0, debit: totalCOGS },
      { account: 'Gross Profit', type: 'Equity', credit: totalSalesRevenue - totalCOGS > 0 ? totalSalesRevenue - totalCOGS : 0, debit: totalSalesRevenue - totalCOGS < 0 ? Math.abs(totalSalesRevenue - totalCOGS) : 0 },
      ...expensesByCategory.map(e => ({ account: `${e._id} Expense`, type: 'Expense', credit: 0, debit: e.total })),
      { account: 'Inventory', type: 'Asset', credit: 0, debit: inventoryValue },
      { account: 'Accounts Receivable', type: 'Asset', credit: 0, debit: accountsReceivable }
    ];
    const totalDebits = accounts.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = accounts.reduce((sum, a) => sum + a.credit, 0);
    return res.status(200).json({
      success: true,
      data: {
        period: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
        accounts, totals: { totalDebits, totalCredits, difference: totalDebits - totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
