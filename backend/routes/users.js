const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
const canManage = authorize('Super Admin', 'CEO');

router.get('/', canManage, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'CEO') {
      query.role = { $in: ['Manager', 'Sales'] };
    }
    const users = await User.find(query)
      .select('-password')
      .populate('created_by', 'username email')
      .sort({ created_at: -1 });
    return res.status(200).json({ success: true, data: users, count: users.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', canManage, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'username, email, password and role are required' });
    }
    const validRoles = ['Super Admin', 'CEO', 'Manager', 'Sales'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    if (req.user.role === 'CEO' && !['Manager', 'Sales'].includes(role)) {
      return res.status(403).json({ success: false, message: 'CEO can only create Manager or Sales users' });
    }
    const existingUser = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    const user = await User.create({ username, email, password, role, created_by: req.user._id });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_USER', module: 'Users',
      details: { created_user: username, role }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    const userObj = user.toObject();
    delete userObj.password;
    return res.status(201).json({ success: true, message: 'User created successfully', data: userObj });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Username or email already exists' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', canManage, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role === 'CEO' && !['Manager', 'Sales'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, message: 'CEO cannot modify Super Admin or CEO users' });
    }
    const { username, email, role, is_active } = req.body;
    if (role && req.user.role === 'CEO' && !['Manager', 'Sales'].includes(role)) {
      return res.status(403).json({ success: false, message: 'CEO can only assign Manager or Sales roles' });
    }
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (typeof is_active === 'boolean') updateData.is_active = is_active;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'UPDATE_USER', module: 'Users',
      details: { updated_user_id: req.params.id, changes: updateData }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Username or email already exists' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', canManage, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role === 'CEO' && !['Manager', 'Sales'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, message: 'CEO cannot delete Super Admin or CEO users' });
    }
    await User.findByIdAndDelete(req.params.id);
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'DELETE_USER', module: 'Users',
      details: { deleted_user: targetUser.username, role: targetUser.role }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'User deleted successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/reset-password', canManage, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ success: false, message: 'new_password is required' });
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role === 'CEO' && !['Manager', 'Sales'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, message: 'CEO cannot reset password for Super Admin or CEO users' });
    }
    targetUser.password = new_password;
    await targetUser.save();
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'RESET_USER_PASSWORD', module: 'Users',
      details: { target_user: targetUser.username }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Password reset successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/toggle-active', canManage, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role === 'CEO' && !['Manager', 'Sales'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, message: 'CEO cannot toggle Super Admin or CEO accounts' });
    }
    targetUser.is_active = !targetUser.is_active;
    await targetUser.save();
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: targetUser.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', module: 'Users',
      details: { target_user: targetUser.username, is_active: targetUser.is_active }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({
      success: true,
      message: `User ${targetUser.is_active ? 'activated' : 'deactivated'} successfully`,
      data: { is_active: targetUser.is_active }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
