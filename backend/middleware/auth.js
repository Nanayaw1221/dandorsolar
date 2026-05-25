const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1] : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'User not found or inactive' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied for your role' });
  }
  next();
};

const ROLE_LEVELS = { 'Sales': 1, 'Manager': 2, 'CEO': 3, 'Super Admin': 4 };

const authorizeLevel = (minLevel) => (req, res, next) => {
  if ((ROLE_LEVELS[req.user.role] || 0) < minLevel) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

module.exports = { protect, authorize, authorizeLevel, ROLE_LEVELS };
