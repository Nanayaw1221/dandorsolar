const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Login with username or email + password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = username || email;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/email and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier.trim() },
        { email: identifier.trim().toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await User.findByIdAndUpdate(user._id, {
      last_login: new Date(),
      last_ip: req.ip || req.connection?.remoteAddress
    });

    AuditLog.create({
      user_id: user._id,
      username: user.username,
      role: user.role,
      action: 'LOGIN',
      module: 'Auth',
      details: { identifier },
      ip_address: req.ip || req.connection?.remoteAddress
    }).catch(err => console.error('Audit log error:', err));

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: { id: user._id, username: user.username, email: user.email, role: user.role }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', protect, async (req, res) => {
  try {
    AuditLog.create({
      user_id: req.user._id,
      username: req.user.username,
      role: req.user.role,
      action: 'LOGOUT',
      module: 'Auth',
      details: {},
      ip_address: req.ip || req.connection?.remoteAddress
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Logged out successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during logout' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('created_by', 'username email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/auth/change-password
 */
router.put('/change-password', protect, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    user.password = new_password;
    await user.save();

    AuditLog.create({
      user_id: req.user._id,
      username: req.user.username,
      role: req.user.role,
      action: 'CHANGE_PASSWORD',
      module: 'Auth',
      details: {},
      ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));

    return res.status(200).json({ success: true, message: 'Password changed successfully', data: null });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
