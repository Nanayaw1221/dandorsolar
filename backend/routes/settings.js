const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('Super Admin', 'CEO'), async (req, res) => {
  try {
    let settings = await Settings.findOne().populate('updated_by', 'username');
    if (!settings) {
      settings = await Settings.create({ company_name: 'DAN & DOR SOLAR COMPANY LIMITED', company_address: 'Ghana', currency_symbol: 'GH₵' });
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/', authorize('Super Admin'), async (req, res) => {
  try {
    const { company_name, company_address, company_phone, company_email, tax_rate, low_stock_alert, receipt_header, receipt_footer, currency_symbol, email_config, notification_settings } = req.body;
    const updateData = { updated_by: req.user._id };
    if (company_name) updateData.company_name = company_name;
    if (company_address) updateData.company_address = company_address;
    if (company_phone !== undefined) updateData.company_phone = company_phone;
    if (company_email !== undefined) updateData.company_email = company_email;
    if (tax_rate !== undefined) updateData.tax_rate = tax_rate;
    if (low_stock_alert !== undefined) updateData.low_stock_alert = low_stock_alert;
    if (receipt_header !== undefined) updateData.receipt_header = receipt_header;
    if (receipt_footer !== undefined) updateData.receipt_footer = receipt_footer;
    if (currency_symbol) updateData.currency_symbol = currency_symbol;
    if (email_config) updateData.email_config = email_config;
    if (notification_settings) updateData.notification_settings = notification_settings;
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ ...updateData });
    else settings = await Settings.findByIdAndUpdate(settings._id, updateData, { new: true });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'UPDATE_SETTINGS', module: 'Settings',
      details: { changes: Object.keys(updateData).filter(k => k !== 'updated_by') }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/logo', authorize('Super Admin'), async (req, res) => {
  try {
    const { logo_base64, logo_url } = req.body;
    const logoValue = logo_url || logo_base64;
    if (!logoValue) return res.status(400).json({ success: false, message: 'logo_base64 or logo_url is required' });
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ logo_url: logoValue });
    else settings = await Settings.findByIdAndUpdate(settings._id, { logo_url: logoValue, updated_by: req.user._id }, { new: true });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'UPDATE_LOGO', module: 'Settings', details: {}, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Logo updated successfully', data: { logo_url: settings.logo_url } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
