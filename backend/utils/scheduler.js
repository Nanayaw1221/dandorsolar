const cron = require('node-cron');

const startScheduler = () => {
  // Check overdue debts daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const Debt = require('../models/Debt');
      await Debt.updateMany(
        { status: 'active', due_date: { $lt: new Date() }, remaining: { $gt: 0 } },
        { $set: { status: 'overdue' } }
      );
      console.log('[Scheduler] Updated overdue debts');
    } catch (err) {
      console.error('[Scheduler] Overdue debts error:', err.message);
    }
  });

  // Check low stock and create notifications daily at 8am
  cron.schedule('0 8 * * *', async () => {
    try {
      const Product = require('../models/Product');
      const Settings = require('../models/Settings');
      const settings = await Settings.findOne();
      const threshold = settings?.low_stock_alert || 5;
      const lowStockProducts = await Product.find({ quantity: { $lte: threshold } }).select('name quantity low_stock_level');
      if (lowStockProducts.length > 0) {
        console.log(`[Scheduler] ${lowStockProducts.length} low stock products found`);
      }
    } catch (err) {
      console.error('[Scheduler] Low stock check error:', err.message);
    }
  });

  console.log('[Scheduler] ITTEK SOLUTION scheduler started');
};

module.exports = { startScheduler };
