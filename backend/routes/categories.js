const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, authorize } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);
const canManage = authorize('Super Admin', 'CEO');

router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json({ success: true, data: categories, count: categories.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', canManage, auditLog('CREATE_CATEGORY', 'Categories'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    const category = await Category.create({ name, description });
    return res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Category name already exists' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', canManage, auditLog('UPDATE_CATEGORY', 'Categories'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findByIdAndUpdate(req.params.id, { name, description }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    return res.status(200).json({ success: true, message: 'Category updated successfully', data: category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Category name already exists' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', canManage, auditLog('DELETE_CATEGORY', 'Categories'), async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    return res.status(200).json({ success: true, message: 'Category deleted successfully', data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
