const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO'));

router.get('/', async (req, res) => {
  try {
    const { user_id, action, module, start_date, end_date, page = 1, limit = 50 } = req.query;
    const query = {};
    if (req.user.role === 'CEO') query.role = { $ne: 'Super Admin' };
    if (user_id) query.user_id = user_id;
    if (action) query.action = { $regex: action, $options: 'i' };
    if (module) query.module = { $regex: module, $options: 'i' };
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) { const end = new Date(end_date); end.setHours(23, 59, 59, 999); query.timestamp.$lte = end; }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query).populate('user_id', 'username email role').skip(skip).limit(parseInt(limit)).sort({ timestamp: -1 });
    return res.status(200).json({
      success: true, data: logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate('user_id', 'username email role');
    if (!log) return res.status(404).json({ success: false, message: 'Audit log not found' });
    if (req.user.role === 'CEO' && log.role === 'Super Admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.status(200).json({ success: true, data: log });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
