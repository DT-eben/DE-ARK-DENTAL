/**
 * Run this once when deploying for a new business:
 *   node setup.js
 *
 * It creates the first staff (owner) login and default business hours.
 * Safe to re-run — it skips anything that already exists.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const Staff = require('./models/Staff');
const BusinessHours = require('./models/BusinessHours');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookly');
  console.log('Connected to database.\n');

  const existingStaff = await Staff.countDocuments();
  if (existingStaff === 0) {
    console.log('No staff accounts found. Let\'s create the owner login.\n');
    const name = await ask('Owner name: ');
    const email = await ask('Owner email: ');
    const password = await ask('Owner password (min 8 characters): ');

    await Staff.create({ name, email, password, isOwner: true });
    console.log('\n✅ Owner account created. You can log in at /admin/auth/login\n');
  } else {
    console.log(`Staff accounts already exist (${existingStaff} found) — skipping owner creation.\n`);
  }

  const existingHours = await BusinessHours.countDocuments();
  if (existingHours === 0) {
    await BusinessHours.insertMany(BusinessHours.defaults());
    console.log('✅ Default business hours created (Mon–Sat, 8am–6pm). Adjust them in Admin → Hours.\n');
  } else {
    console.log('Business hours already configured — skipping.\n');
  }

  rl.close();
  await mongoose.disconnect();
})();
