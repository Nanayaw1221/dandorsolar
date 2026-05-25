const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  company_name: { type: String, default: 'DAN & DOR SOLAR COMPANY LIMITED' },
  company_address: { type: String, default: 'Ghana' },
  company_phone: String,
  company_email: String,
  logo_url: String,
  tax_rate: { type: Number, default: 0 },
  low_stock_alert: { type: Number, default: 5 },
  receipt_header: String,
  receipt_footer: String,
  currency_symbol: { type: String, default: 'GH₵' },
  email_config: {
    smtp_host: String,
    smtp_port: Number,
    smtp_user: String,
    smtp_pass: String,
    from_email: String,
    enabled: { type: Boolean, default: false }
  },
  notification_settings: {
    large_sale_threshold: { type: Number, default: 5000 },
    expense_threshold: { type: Number, default: 1000 },
    email_notifications: { type: Boolean, default: false }
  },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
