const express = require('express');
const router = express.Router();
const StockRequest = require('../models/StockRequest');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('Super Admin', 'CEO', 'Manager'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = {};
    if (req.user.role === 'Manager') query.created_by = req.user._id;
    if (status) query.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await StockRequest.countDocuments(query);
    const requests = await StockRequest.find(query)
      .populate('created_by', 'username role').populate('approved_by', 'username').populate('rejected_by', 'username')
      .skip(skip).limit(parseInt(limit)).sort({ request_date: -1 });
    return res.status(200).json({
      success: true, data: requests,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', authorize('Super Admin', 'CEO', 'Manager'), async (req, res) => {
  try {
    const request = await StockRequest.findById(req.params.id)
      .populate('created_by', 'username role').populate('approved_by', 'username').populate('rejected_by', 'username');
    if (!request) return res.status(404).json({ success: false, message: 'Stock request not found' });
    if (req.user.role === 'Manager' && request.created_by._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', authorize('Super Admin', 'CEO', 'Manager'), async (req, res) => {
  try {
    const { notes, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }
    let totalAmount = 0;
    const requestItems = [];
    for (const item of items) {
      if (!item.product_name || !item.quantity_requested || !item.estimated_cost) {
        return res.status(400).json({ success: false, message: 'Each item needs product_name, quantity_requested, and estimated_cost' });
      }
      const itemTotal = item.quantity_requested * item.estimated_cost;
      totalAmount += itemTotal;
      requestItems.push({ product_id: item.product_id || undefined, product_name: item.product_name, quantity_requested: item.quantity_requested, estimated_cost: item.estimated_cost, total: itemTotal });
    }
    const stockRequest = await StockRequest.create({ created_by: req.user._id, request_date: new Date(), status: 'pending', total_amount: totalAmount, notes, items: requestItems });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_STOCK_REQUEST', module: 'StockRequests',
      details: { request_id: stockRequest._id, total_amount: totalAmount, items: requestItems.length }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(201).json({ success: true, message: 'Stock request created', data: stockRequest });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/approve', authorize('Super Admin', 'CEO'), async (req, res) => {
  try {
    const request = await StockRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Stock request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: `Cannot approve a request with status: ${request.status}` });
    request.status = 'approved';
    request.approved_by = req.user._id;
    request.approved_date = new Date();
    await request.save();
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'APPROVE_STOCK_REQUEST', module: 'StockRequests',
      details: { request_id: req.params.id }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    const populated = await StockRequest.findById(req.params.id).populate('created_by', 'username').populate('approved_by', 'username');
    return res.status(200).json({ success: true, message: 'Stock request approved', data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/reject', authorize('Super Admin', 'CEO'), async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    const request = await StockRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Stock request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: `Cannot reject a request with status: ${request.status}` });
    request.status = 'rejected';
    request.rejected_by = req.user._id;
    request.rejection_reason = rejection_reason || 'No reason provided';
    await request.save();
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'REJECT_STOCK_REQUEST', module: 'StockRequests',
      details: { request_id: req.params.id, rejection_reason }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    const populated = await StockRequest.findById(req.params.id).populate('created_by', 'username').populate('rejected_by', 'username');
    return res.status(200).json({ success: true, message: 'Stock request rejected', data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', authorize('Super Admin'), async (req, res) => {
  try {
    const request = await StockRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Stock request not found' });
    return res.status(200).json({ success: true, message: 'Stock request deleted', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
