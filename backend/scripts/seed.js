require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('../models/User');
  const Product = require('../models/Product');
  const Category = require('../models/Category');
  const Supplier = require('../models/Supplier');
  const Settings = require('../models/Settings');

  // ── Seed Categories ──
  const categories = [
    { name: 'Solar Panels', description: 'Photovoltaic solar panels' },
    { name: 'Inverters', description: 'Solar power inverters' },
    { name: 'Batteries', description: 'Solar storage batteries' },
    { name: 'Charge Controllers', description: 'Solar charge controllers' },
    { name: 'Lighting', description: 'Solar lighting solutions' },
    { name: 'Accessories', description: 'Cables, connectors and accessories' },
  ];
  for (const cat of categories) {
    await Category.findOneAndUpdate({ name: cat.name }, cat, { upsert: true, new: true });
  }
  console.log('✓ Categories seeded');

  // ── Seed Supplier ──
  await Supplier.findOneAndUpdate(
    { name: 'Ghana Solar Distributors Ltd' },
    { name: 'Ghana Solar Distributors Ltd', phone: '+233 20 000 0001', address: 'Accra, Ghana', email: 'info@ghanasolar.com' },
    { upsert: true }
  );
  console.log('✓ Supplier seeded');

  const panelCat = await Category.findOne({ name: 'Solar Panels' });
  const invCat = await Category.findOne({ name: 'Inverters' });
  const batCat = await Category.findOne({ name: 'Batteries' });
  const ctlCat = await Category.findOne({ name: 'Charge Controllers' });
  const litCat = await Category.findOne({ name: 'Lighting' });
  const accCat = await Category.findOne({ name: 'Accessories' });
  const supplier = await Supplier.findOne({ name: 'Ghana Solar Distributors Ltd' });

  // ── Seed Products ──
  const products = [
    { name: 'Solar Panel 200W Monocrystalline', barcode: 'SP200W001', category_id: panelCat._id, supplier_id: supplier._id, quantity: 50, cost_price: 1200, selling_price: 1800, low_stock_level: 5 },
    { name: 'Solar Panel 300W Monocrystalline', barcode: 'SP300W001', category_id: panelCat._id, supplier_id: supplier._id, quantity: 30, cost_price: 1800, selling_price: 2500, low_stock_level: 5 },
    { name: 'Solar Panel 400W Monocrystalline', barcode: 'SP400W001', category_id: panelCat._id, supplier_id: supplier._id, quantity: 20, cost_price: 2400, selling_price: 3400, low_stock_level: 5 },
    { name: 'Solar Inverter 1000W Pure Sine Wave', barcode: 'INV1000W01', category_id: invCat._id, supplier_id: supplier._id, quantity: 20, cost_price: 2500, selling_price: 3500, low_stock_level: 3 },
    { name: 'Solar Inverter 2000W Pure Sine Wave', barcode: 'INV2000W01', category_id: invCat._id, supplier_id: supplier._id, quantity: 15, cost_price: 4500, selling_price: 6000, low_stock_level: 3 },
    { name: 'Solar Inverter 5000W Hybrid', barcode: 'INV5000W01', category_id: invCat._id, supplier_id: supplier._id, quantity: 8, cost_price: 9000, selling_price: 13000, low_stock_level: 2 },
    { name: 'Solar Battery 100Ah 12V AGM', barcode: 'BAT100AH01', category_id: batCat._id, supplier_id: supplier._id, quantity: 40, cost_price: 1500, selling_price: 2200, low_stock_level: 5 },
    { name: 'Solar Battery 200Ah 12V AGM', barcode: 'BAT200AH01', category_id: batCat._id, supplier_id: supplier._id, quantity: 25, cost_price: 2800, selling_price: 4000, low_stock_level: 5 },
    { name: 'Solar Battery 100Ah Lithium (LiFePO4)', barcode: 'BAT100LI01', category_id: batCat._id, supplier_id: supplier._id, quantity: 15, cost_price: 4500, selling_price: 6500, low_stock_level: 3 },
    { name: 'Solar Charge Controller 30A PWM', barcode: 'CCT30A001', category_id: ctlCat._id, supplier_id: supplier._id, quantity: 60, cost_price: 350, selling_price: 550, low_stock_level: 10 },
    { name: 'Solar Charge Controller 60A MPPT', barcode: 'CCT60A001', category_id: ctlCat._id, supplier_id: supplier._id, quantity: 35, cost_price: 900, selling_price: 1400, low_stock_level: 5 },
    { name: 'LED Solar Bulb 5W', barcode: 'LBL5W001', category_id: litCat._id, supplier_id: supplier._id, quantity: 200, cost_price: 25, selling_price: 45, low_stock_level: 20 },
    { name: 'LED Solar Bulb 10W', barcode: 'LBL10W001', category_id: litCat._id, supplier_id: supplier._id, quantity: 150, cost_price: 40, selling_price: 70, low_stock_level: 20 },
    { name: 'Solar Street Light 50W', barcode: 'STL50W001', category_id: litCat._id, supplier_id: supplier._id, quantity: 30, cost_price: 850, selling_price: 1300, low_stock_level: 5 },
    { name: 'Solar Cable 6mm (per meter)', barcode: 'CBL6MM001', category_id: accCat._id, supplier_id: supplier._id, quantity: 500, cost_price: 15, selling_price: 25, low_stock_level: 50 },
    { name: 'MC4 Connector Pair', barcode: 'MC4CON001', category_id: accCat._id, supplier_id: supplier._id, quantity: 300, cost_price: 8, selling_price: 15, low_stock_level: 30 },
    { name: 'Solar Mounting Bracket Set', barcode: 'MNT001', category_id: accCat._id, supplier_id: supplier._id, quantity: 80, cost_price: 120, selling_price: 200, low_stock_level: 10 },
    { name: 'DC Circuit Breaker 32A', barcode: 'DCB32A001', category_id: accCat._id, supplier_id: supplier._id, quantity: 100, cost_price: 55, selling_price: 90, low_stock_level: 15 },
  ];
  for (const prod of products) {
    await Product.findOneAndUpdate({ barcode: prod.barcode }, prod, { upsert: true, new: true });
  }
  console.log('✓ Products seeded');

  // ── Seed Users ──
  const users = [
    { username: 'superadmin', email: 'superadmin@dandorsolar.com', password: 'Admin@2024', role: 'Super Admin' },
    { username: 'ceo', email: 'ceo@dandorsolar.com', password: 'CEO@2024', role: 'CEO' },
    { username: 'manager', email: 'manager@dandorsolar.com', password: 'Manager@2024', role: 'Manager' },
    { username: 'sales1', email: 'sales1@dandorsolar.com', password: 'Sales@2024', role: 'Sales' },
  ];
  for (const u of users) {
    const existing = await User.findOne({ username: u.username });
    if (!existing) {
      await User.create(u);
      console.log(`✓ User created: ${u.username} (${u.role})`);
    } else {
      console.log(`  User already exists: ${u.username}`);
    }
  }

  // ── Seed Settings ──
  const settingsExist = await Settings.findOne();
  if (!settingsExist) {
    await Settings.create({
      company_name: 'DAN & DOR SOLAR COMPANY LIMITED',
      company_address: 'Accra, Ghana',
      company_phone: '+233 00 000 0000',
      company_email: 'info@dandorsolar.com',
      currency_symbol: 'GH₵',
      tax_rate: 0,
      low_stock_alert: 5,
      receipt_header: 'DAN & DOR SOLAR COMPANY LIMITED',
      receipt_footer: 'Thank you for your business!',
    });
    console.log('✓ Settings seeded');
  }

  console.log('\n✅ ITTEK SOLUTION seed complete.');
  console.log('\nDefault login credentials:');
  console.log('  Super Admin: superadmin / Admin@2024');
  console.log('  CEO:         ceo / CEO@2024');
  console.log('  Manager:     manager / Manager@2024');
  console.log('  Sales:       sales1 / Sales@2024');
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
