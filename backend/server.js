require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');

// ─── APP SETUP ───────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// CORS: allow requests from frontend URL
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
      'http://localhost:4173',
    ].filter(Boolean);

    const isRender = origin && /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin);

    if (!origin || isRender || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Rate limiting: 200 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
});
app.use(limiter);

// ─── REQUEST PARSING ──────────────────────────────────────────────────────────

app.use(
  express.json({
    limit: '20mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── LOGGING ─────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── STATIC FILES ─────────────────────────────────────────────────────────────

const uploadsPath = path.resolve(process.env.UPLOAD_PATH || './uploads');
app.use('/uploads', express.static(uploadsPath));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ITTEK SOLUTION - DAN & DOR SOLAR API is running.',
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0',
      company: 'DAN & DOR SOLAR COMPANY LIMITED',
    },
  });
});

// ─── DB STATUS ────────────────────────────────────────────────────────────────

app.get('/api/dbstatus', async (req, res) => {
  const mongoose = require('mongoose');
  const User = require('./models/User');
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  try {
    const userCount = await User.countDocuments();
    const superAdmin = await User.findOne({ role: 'Super Admin' }).select('username email role is_active');
    res.json({ dbState, userCount, superAdmin });
  } catch (e) {
    res.json({ dbState, error: e.message });
  }
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/worker-payments', require('./routes/worker-payments'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/stock-requests', require('./routes/stock-requests'));
app.use('/api/credit-agreements', require('./routes/credit-agreements'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/financial', require('./routes/financial'));
app.use('/api/audit-logs', require('./routes/audit-logs'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/notifications', require('./routes/notifications'));

// ─── SERVE REACT FRONTEND ─────────────────────────────────────────────────────

const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist));

// Any non-API route serves index.html so React Router handles it
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({ success: false, message: 'Not allowed by CORS policy.' });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation error.', errors: messages });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate value: ${field} already exists.` });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const seedDatabase = async () => {
  try {
    const User = require('./models/User');
    const Category = require('./models/Category');
    const Product = require('./models/Product');
    const Settings = require('./models/Settings');

    // ── Seed Users ──
    const usersToSeed = [
      {
        username: 'superadmin',
        email: 'superadmin@dandorsolar.com',
        password: 'Admin@2024',
        role: 'Super Admin',
      },
      {
        username: 'ceo',
        email: 'ceo@dandorsolar.com',
        password: 'CEO@2024',
        role: 'CEO',
      },
      {
        username: 'manager',
        email: 'manager@dandorsolar.com',
        password: 'Manager@2024',
        role: 'Manager',
      },
      {
        username: 'sales1',
        email: 'sales1@dandorsolar.com',
        password: 'Sales@2024',
        role: 'Sales',
      },
    ];

    for (const userData of usersToSeed) {
      const existing = await User.findOne({ username: userData.username });
      if (!existing) {
        await User.create(userData);
        console.log(`✓ Created user: ${userData.username} (${userData.role})`);
      }
    }

    // ── Seed Settings ──
    const settingsExist = await Settings.findOne();
    if (!settingsExist) {
      await Settings.create({
        company_name: 'DAN & DOR SOLAR COMPANY LIMITED',
        company_address: 'Ghana',
        currency_symbol: 'GH₵',
        low_stock_alert: 5,
        tax_rate: 0,
      });
      console.log('✓ Default settings created');
    }

    // ── Seed Categories ──
    const categoryNames = ['Solar Panels', 'Solar Inverters', 'Solar Batteries', 'Solar Bulbs', 'Solar Accessories', 'Cables & Wires'];
    const categoryMap = {};

    for (const name of categoryNames) {
      let cat = await Category.findOne({ name });
      if (!cat) {
        cat = await Category.create({ name });
        console.log(`✓ Created category: ${name}`);
      }
      categoryMap[name] = cat._id;
    }

    // ── Seed Sample Products ──
    const productsToSeed = [
      { name: 'Solar Panel 200W', category: 'Solar Panels', cost_price: 1200, selling_price: 1800, quantity: 50, low_stock_level: 5 },
      { name: 'Solar Panel 300W', category: 'Solar Panels', cost_price: 1800, selling_price: 2500, quantity: 30, low_stock_level: 5 },
      { name: 'Solar Inverter 1000W', category: 'Solar Inverters', cost_price: 2500, selling_price: 3500, quantity: 20, low_stock_level: 3 },
      { name: 'Solar Inverter 2000W', category: 'Solar Inverters', cost_price: 4500, selling_price: 6000, quantity: 15, low_stock_level: 3 },
      { name: 'Solar Battery 100Ah', category: 'Solar Batteries', cost_price: 1500, selling_price: 2200, quantity: 40, low_stock_level: 5 },
      { name: 'Solar Battery 200Ah', category: 'Solar Batteries', cost_price: 2800, selling_price: 4000, quantity: 25, low_stock_level: 5 },
      { name: 'LED Solar Bulb 5W', category: 'Solar Bulbs', cost_price: 25, selling_price: 45, quantity: 200, low_stock_level: 20 },
      { name: 'LED Solar Bulb 10W', category: 'Solar Bulbs', cost_price: 40, selling_price: 70, quantity: 150, low_stock_level: 20 },
      { name: 'Solar Charge Controller 30A', category: 'Solar Accessories', cost_price: 350, selling_price: 550, quantity: 60, low_stock_level: 10 },
      { name: 'Solar Cable 6mm (per meter)', category: 'Cables & Wires', cost_price: 15, selling_price: 25, quantity: 500, low_stock_level: 50 },
    ];

    for (const productData of productsToSeed) {
      const existing = await Product.findOne({ name: productData.name });
      if (!existing) {
        await Product.create({
          name: productData.name,
          category_id: categoryMap[productData.category],
          cost_price: productData.cost_price,
          selling_price: productData.selling_price,
          quantity: productData.quantity,
          low_stock_level: productData.low_stock_level,
        });
        console.log(`✓ Created product: ${productData.name}`);
      }
    }

    console.log('\nDatabase seed complete. ITTEK SOLUTION is ready.');
    console.log('Default credentials:');
    console.log('  Super Admin: superadmin / Admin@2024');
    console.log('  CEO:         ceo / CEO@2024');
    console.log('  Manager:     manager / Manager@2024');
    console.log('  Sales:       sales1 / Sales@2024\n');
  } catch (error) {
    console.error('Database seed error:', error.message);
  }
};

// ─── SERVER START ─────────────────────────────────────────────────────────────

const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  ITTEK SOLUTION`);
    console.log(`  DAN & DOR SOLAR COMPANY LIMITED`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
    console.log(`========================================\n`);
  });

  try {
    await connectDB();
    await seedDatabase();
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();
  } catch (error) {
    console.error('MongoDB init failed:', error.message);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

module.exports = app;
