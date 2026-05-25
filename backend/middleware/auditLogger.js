const AuditLog = require('../models/AuditLog');

const auditLog = (action, module) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    if (res.statusCode < 400 && req.user) {
      AuditLog.create({
        user_id: req.user._id,
        username: req.user.username,
        role: req.user.role,
        action,
        module,
        details: { body: req.body, params: req.params, query: req.query },
        ip_address: req.ip || req.connection?.remoteAddress,
        timestamp: new Date()
      }).catch(err => console.error('Audit log error:', err));
    }
    return originalJson(body);
  };
  next();
};

module.exports = { auditLog };
