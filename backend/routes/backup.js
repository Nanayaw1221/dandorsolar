const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO'));

const backupHistory = [];

router.post('/create', async (req, res) => {
  try {
    const collections = mongoose.connection.collections;
    const backup = { created_at: new Date().toISOString(), created_by: req.user.username, version: '1.0', data: {} };
    const collectionNames = Object.keys(collections);
    for (const name of collectionNames) {
      const docs = await collections[name].find({}).toArray();
      backup.data[name] = docs;
    }
    const backupEntry = {
      id: `backup-${Date.now()}`, created_at: backup.created_at, created_by: req.user.username,
      collections: collectionNames.length, totalDocuments: Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0),
      size: JSON.stringify(backup.data).length
    };
    backupHistory.push(backupEntry);
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_BACKUP', module: 'Backup',
      details: { collections: collectionNames.length, totalDocs: backupEntry.totalDocuments }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Backup created successfully', data: backup });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during backup' });
  }
});

router.get('/list', async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: backupHistory.slice().reverse(), count: backupHistory.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
