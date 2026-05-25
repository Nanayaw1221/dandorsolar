const express = require('express');
const router = express.Router();
const CreditAgreement = require('../models/CreditAgreement');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Super Admin', 'CEO', 'Manager'));

router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [{ customer_name: { $regex: search, $options: 'i' } }, { customer_phone: { $regex: search, $options: 'i' } }];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await CreditAgreement.countDocuments(query);
    const agreements = await CreditAgreement.find(query).populate('created_by', 'username').skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true, data: agreements,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const agreement = await CreditAgreement.findById(req.params.id).populate('created_by', 'username');
    if (!agreement) return res.status(404).json({ success: false, message: 'Credit agreement not found' });
    return res.status(200).json({ success: true, data: agreement });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, customer_photo, guarantor_name, guarantor_phone, guarantor_address, total_amount, down_payment = 0, interest_rate = 0, start_date, end_date, items } = req.body;
    if (!customer_name || !total_amount) {
      return res.status(400).json({ success: false, message: 'customer_name and total_amount are required' });
    }
    const totalWithInterest = total_amount + (total_amount * interest_rate / 100);
    const remaining = totalWithInterest - down_payment;
    const agreement = await CreditAgreement.create({
      customer_name, customer_phone, customer_address, customer_photo, guarantor_name, guarantor_phone, guarantor_address,
      total_amount: totalWithInterest, down_payment, remaining, interest_rate,
      start_date: start_date ? new Date(start_date) : new Date(),
      end_date: end_date ? new Date(end_date) : undefined,
      items: items || [], created_by: req.user._id,
      payments: down_payment > 0 ? [{ amount: down_payment, payment_date: new Date(), week_number: 0, receipt_no: `DP-${Date.now()}` }] : []
    });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREATE_CREDIT_AGREEMENT', module: 'CreditAgreements',
      details: { customer_name, total_amount: totalWithInterest, remaining }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(201).json({ success: true, message: 'Credit agreement created', data: agreement });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:id/payment', async (req, res) => {
  try {
    const { amount, week_number, receipt_no } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0' });
    const agreement = await CreditAgreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ success: false, message: 'Credit agreement not found' });
    if (agreement.status === 'completed') return res.status(400).json({ success: false, message: 'This agreement is already completed' });
    if (amount > agreement.remaining) return res.status(400).json({ success: false, message: `Payment (${amount}) exceeds remaining balance (${agreement.remaining})` });
    agreement.payments.push({ amount, payment_date: new Date(), week_number: week_number || agreement.payments.length + 1, receipt_no: receipt_no || `RCP-${Date.now()}` });
    agreement.remaining = Math.max(0, agreement.remaining - amount);
    if (agreement.remaining <= 0) agreement.status = 'completed';
    await agreement.save();
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'CREDIT_AGREEMENT_PAYMENT', module: 'CreditAgreements',
      details: { agreement_id: req.params.id, amount, remaining: agreement.remaining, status: agreement.status }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Payment recorded', data: agreement });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, customer_photo, guarantor_name, guarantor_phone, guarantor_address, status, end_date } = req.body;
    const updateData = {};
    if (customer_name) updateData.customer_name = customer_name;
    if (customer_phone) updateData.customer_phone = customer_phone;
    if (customer_address) updateData.customer_address = customer_address;
    if (customer_photo) updateData.customer_photo = customer_photo;
    if (guarantor_name) updateData.guarantor_name = guarantor_name;
    if (guarantor_phone) updateData.guarantor_phone = guarantor_phone;
    if (guarantor_address) updateData.guarantor_address = guarantor_address;
    if (status) updateData.status = status;
    if (end_date) updateData.end_date = new Date(end_date);
    const agreement = await CreditAgreement.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('created_by', 'username');
    if (!agreement) return res.status(404).json({ success: false, message: 'Credit agreement not found' });
    AuditLog.create({
      user_id: req.user._id, username: req.user.username, role: req.user.role,
      action: 'UPDATE_CREDIT_AGREEMENT', module: 'CreditAgreements',
      details: { agreement_id: req.params.id, changes: updateData }, ip_address: req.ip
    }).catch(err => console.error('Audit log error:', err));
    return res.status(200).json({ success: true, message: 'Credit agreement updated', data: agreement });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', authorize('Super Admin'), async (req, res) => {
  try {
    const agreement = await CreditAgreement.findByIdAndDelete(req.params.id);
    if (!agreement) return res.status(404).json({ success: false, message: 'Credit agreement not found' });
    return res.status(200).json({ success: true, message: 'Credit agreement deleted', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
