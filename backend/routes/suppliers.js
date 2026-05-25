const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { protect, authorize } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);
const canManage = authorize('Super Admin', 'CEO');

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    const suppliers = await Supplier.find(query).sort({ name: 1 });
    return res.status(200).json({ success: true, data: suppliers, count: suppliers.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    return res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', canManage, auditLog('CREATE_SUPPLIER', 'Suppliers'), async (req, res) => {
  try {
    const { name, phone, address, email } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required' });
    const supplier = await Supplier.create({ name, phone, address, email });
    return res.status(201).json({ success: true, message: 'Supplier created successfully', data: supplier });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', canManage, auditLog('UPDATE_SUPPLIER', 'Suppliers'), async (req, res) => {
  try {
    const { name, phone, address, email } = req.body;
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { name, phone, address, email }, { new: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    return res.status(200).json({ success: true, message: 'Supplier updated successfully', data: supplier });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', canManage, auditLog('DELETE_SUPPLIER', 'Suppliers'), async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    return res.status(200).json({ success: true, message: 'Supplier deleted successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
