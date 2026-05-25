const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Debt = require('../models/Debt');
const StockRequest = require('../models/StockRequest');
const CreditAgreement = require('../models/CreditAgreement');
const { protect } = require('../middleware/auth');

router.use(protect);

const readNotifications = new Map();

router.get('/', async (req, res) => {
  try {
    const notifications = [];
    const userId = req.user._id.toString();
    const lowStockProducts = await Product.find({ $expr: { $lte: ['$quantity', '$low_stock_level'] } }).populate('category_id', 'name').limit(20);
    lowStockProducts.forEach(product => {
      const notifId = `low-stock-${product._id}`;
      notifications.push({
        id: notifId, type: 'low_stock', severity: product.quantity === 0 ? 'critical' : 'warning',
        title: product.quantity === 0 ? 'Out of Stock' : 'Low Stock Alert',
        message: `${product.name} has only ${product.quantity} units remaining (threshold: ${product.low_stock_level})`,
        data: { product_id: product._id, product_name: product.name, quantity: product.quantity, low_stock_level: product.low_stock_level },
        read: readNotifications.has(`${userId}-${notifId}`), created_at: new Date()
      });
    });
    if (['Super Admin', 'CEO', 'Manager'].includes(req.user.role)) {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const overdueDebts = await Debt.find({ status: 'active', due_date: { $lte: now } }).limit(20);
      overdueDebts.forEach(debt => {
        const notifId = `debt-overdue-${debt._id}`;
        notifications.push({
          id: notifId, type: 'debt_overdue', severity: 'critical', title: 'Overdue Debt',
          message: `${debt.customer_name} has an overdue debt of GH₵${debt.remaining.toFixed(2)}`,
          data: { debt_id: debt._id, customer_name: debt.customer_name, remaining: debt.remaining, due_date: debt.due_date },
          read: readNotifications.has(`${userId}-${notifId}`), created_at: debt.due_date || new Date()
        });
      });
      const upcomingDebts = await Debt.find({ status: 'active', due_date: { $gt: now, $lte: threeDaysFromNow } }).limit(10);
      upcomingDebts.forEach(debt => {
        const notifId = `debt-upcoming-${debt._id}`;
        notifications.push({
          id: notifId, type: 'debt_due_soon', severity: 'warning', title: 'Debt Due Soon',
          message: `${debt.customer_name}'s debt of GH₵${debt.remaining.toFixed(2)} is due on ${debt.due_date?.toLocaleDateString()}`,
          data: { debt_id: debt._id, customer_name: debt.customer_name, remaining: debt.remaining, due_date: debt.due_date },
          read: readNotifications.has(`${userId}-${notifId}`), created_at: new Date()
        });
      });
      const overdueAgreements = await CreditAgreement.find({ status: 'active', end_date: { $lte: now }, remaining: { $gt: 0 } }).limit(10);
      overdueAgreements.forEach(agreement => {
        const notifId = `credit-overdue-${agreement._id}`;
        notifications.push({
          id: notifId, type: 'credit_agreement_overdue', severity: 'critical', title: 'Credit Agreement Overdue',
          message: `${agreement.customer_name}'s credit agreement has ended with GH₵${agreement.remaining.toFixed(2)} still remaining`,
          data: { agreement_id: agreement._id, customer_name: agreement.customer_name, remaining: agreement.remaining, end_date: agreement.end_date },
          read: readNotifications.has(`${userId}-${notifId}`), created_at: agreement.end_date || new Date()
        });
      });
    }
    if (['Super Admin', 'CEO'].includes(req.user.role)) {
      const pendingRequests = await StockRequest.find({ status: 'pending' }).populate('created_by', 'username').limit(20);
      pendingRequests.forEach(request => {
        const notifId = `stock-request-${request._id}`;
        notifications.push({
          id: notifId, type: 'stock_request_pending', severity: 'info', title: 'Pending Stock Request',
          message: `${request.created_by?.username || 'A user'} submitted a stock request for GH₵${request.total_amount?.toFixed(2)}`,
          data: { request_id: request._id, created_by: request.created_by?.username, total_amount: request.total_amount, request_date: request.request_date },
          read: readNotifications.has(`${userId}-${notifId}`), created_at: request.request_date || new Date()
        });
      });
    }
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    return res.status(200).json({ success: true, data: notifications, count: notifications.length, unreadCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: 'All notifications marked as read', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const notifId = req.params.id;
    readNotifications.set(`${userId}-${notifId}`, true);
    return res.status(200).json({ success: true, message: 'Notification marked as read', data: { id: notifId, read: true } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
