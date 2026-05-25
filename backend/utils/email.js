const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');
const EmailQueue = require('../models/EmailQueue');

const getTransporter = async () => {
  const settings = await Settings.findOne();
  const cfg = settings?.email_config;
  if (!cfg?.enabled || !cfg?.smtp_host) return null;
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port || 587,
    secure: cfg.smtp_port === 465,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });
};

const queueEmail = async ({ to_email, subject, body, priority = 'normal' }) => {
  try {
    await EmailQueue.create({ to_email, subject, body, priority, status: 'pending' });
  } catch (err) {
    console.error('Email queue error:', err.message);
  }
};

const processEmailQueue = async () => {
  const transporter = await getTransporter();
  if (!transporter) return;
  const pending = await EmailQueue.find({ status: 'pending', retry_count: { $lt: 3 } }).limit(10);
  for (const email of pending) {
    try {
      const settings = await Settings.findOne();
      await transporter.sendMail({
        from: settings?.email_config?.from_email || 'noreply@dandorsolar.com',
        to: email.to_email,
        subject: email.subject,
        html: email.body,
      });
      await EmailQueue.findByIdAndUpdate(email._id, { status: 'sent', sent_at: new Date() });
    } catch (err) {
      await EmailQueue.findByIdAndUpdate(email._id, {
        status: email.retry_count >= 2 ? 'failed' : 'pending',
        $inc: { retry_count: 1 },
        error_message: err.message,
      });
    }
  }
};

const sendSaleNotification = async ({ to_email, invoiceNo, amount, customerName, items }) => {
  const subject = `New Sale - ${invoiceNo} | GH₵${amount.toLocaleString()}`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#F97316;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;margin:0;font-size:22px">New Sale Recorded</h1>
        <p style="color:rgba(255,255,255,0.9);margin:4px 0 0">DAN & DOR SOLAR COMPANY LIMITED</p>
      </div>
      <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p><strong>Invoice:</strong> ${invoiceNo}</p>
        <p><strong>Customer:</strong> ${customerName || 'Walk-in'}</p>
        <p><strong>Total Amount:</strong> GH₵${amount.toLocaleString()}</p>
        ${items ? `<p><strong>Items:</strong> ${items.map(i => `${i.product_name} x${i.quantity}`).join(', ')}</p>` : ''}
      </div>
    </div>`;
  await queueEmail({ to_email, subject, body, priority: 'high' });
};

const sendDebtNotification = async ({ to_email, customerName, amount, dueDate, invoiceNo }) => {
  const subject = `Short Payment Recorded - ${customerName} owes GH₵${amount.toLocaleString()}`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#F59E0B;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;margin:0">Short Payment – Debt Created</h1>
      </div>
      <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Amount Owed:</strong> GH₵${amount.toLocaleString()}</p>
        <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
        <p><strong>Invoice:</strong> ${invoiceNo}</p>
      </div>
    </div>`;
  await queueEmail({ to_email, subject, body, priority: 'high' });
};

const sendLowStockAlert = async ({ to_email, products }) => {
  const subject = `⚠️ Low Stock Alert – ${products.length} product(s) running low`;
  const rows = products.map(p =>
    `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${p.name}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#EF4444;font-weight:bold">${p.quantity}</td></tr>`
  ).join('');
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#EF4444;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;margin:0">⚠️ Low Stock Alert</h1>
        <p style="color:rgba(255,255,255,0.9);margin:4px 0 0">DAN & DOR SOLAR COMPANY LIMITED</p>
      </div>
      <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:8px;background:#FFF7ED;font-size:13px">Product</th>
            <th style="text-align:left;padding:8px;background:#FFF7ED;font-size:13px">Qty Remaining</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;color:#6b7280;font-size:13px">Please restock these items soon.</p>
      </div>
    </div>`;
  await queueEmail({ to_email, subject, body, priority: 'critical' });
};

module.exports = { queueEmail, processEmailQueue, sendSaleNotification, sendDebtNotification, sendLowStockAlert };
