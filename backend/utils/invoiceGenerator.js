const Sale = require('../models/Sale');

/**
 * Generate invoice number in format: INV-{YYYYMMDD}-{4-digit-sequence}
 * Example: INV-20260524-0001
 */
const generateInvoiceNo = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  const prefix = `INV-${datePart}-`;
  const lastSale = await Sale.findOne(
    { invoice_no: { $regex: `^${prefix}` } },
    { invoice_no: 1 },
    { sort: { invoice_no: -1 } }
  );

  let sequence = 1;
  if (lastSale) {
    const parts = lastSale.invoice_no.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

module.exports = { generateInvoiceNo };
