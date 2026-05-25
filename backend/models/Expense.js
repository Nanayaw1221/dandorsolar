const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    enum: ['Rent', 'Utilities', 'Transport', 'Salaries', 'Maintenance', 'Marketing', 'Other'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  expense_date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
