// scripts/seed.js
// Populates the minimum data the backend needs to be usable end-to-end:
// a few Departments (Step 8 routing targets), one admin + one
// department_staff account (Section 4), and the Template collection
// seeded from the static messageCatalog (Notes section: template set is
// "on the critical path"). Safe to re-run — uses upserts throughout.
//
// Usage: npm run seed

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Department from '../src/models/Department.js';
import Staff from '../src/models/Staff.js';
import Template from '../src/models/Template.js';
import { messageCatalog } from '../src/templates/messageCatalog.js';

const DEPARTMENTS = [
  { name: 'Water Supply', code: 'WATER', slaHours: 48, keywords: ['water', 'leak', 'pipeline', 'supply'] },
  { name: 'Sanitation & Sewage', code: 'SANITATION', slaHours: 48, keywords: ['garbage', 'sewage', 'drain', 'trash'] },
  { name: 'Roads & Infrastructure', code: 'ROADS', slaHours: 96, keywords: ['pothole', 'road', 'footpath'] },
  { name: 'Electricity', code: 'ELECTRICITY', slaHours: 24, keywords: ['power', 'streetlight', 'transformer'] },
  { name: 'General Administration', code: 'GENERAL', slaHours: 72, keywords: [] },
];

async function seedDepartments() {
  const results = [];
  for (const dept of DEPARTMENTS) {
    // eslint-disable-next-line no-await-in-loop
    const doc = await Department.findOneAndUpdate({ code: dept.code }, { $set: dept }, { upsert: true, new: true });
    results.push(doc);
  }
  console.log(`[seed] upserted ${results.length} departments`);
  return results;
}

async function seedStaff(departments) {
  const waterDept = departments.find((d) => d.code === 'WATER');

  const adminPasswordHash = await Staff.hashPassword('ChangeMe123!');
  const staffPasswordHash = await Staff.hashPassword('ChangeMe123!');

  await Staff.findOneAndUpdate(
    { email: 'admin@nagriksahayak.gov.in' },
    {
      $set: {
        name: 'System Admin',
        email: 'admin@nagriksahayak.gov.in',
        passwordHash: adminPasswordHash,
        role: 'admin',
        department: null,
        isActive: true,
      },
    },
    { upsert: true }
  );

  await Staff.findOneAndUpdate(
    { email: 'water.staff@nagriksahayak.gov.in' },
    {
      $set: {
        name: 'Water Dept Staff',
        email: 'water.staff@nagriksahayak.gov.in',
        passwordHash: staffPasswordHash,
        role: 'department_staff',
        department: waterDept?._id,
        isActive: true,
      },
    },
    { upsert: true }
  );

  console.log('[seed] upserted 2 staff accounts (password for both: "ChangeMe123!" — change before real use)');
}

async function seedTemplates() {
  let count = 0;
  for (const [language, templates] of Object.entries(messageCatalog)) {
    for (const [key, text] of Object.entries(templates)) {
      // eslint-disable-next-line no-await-in-loop
      await Template.findOneAndUpdate(
        { key, language, channel: 'WHATSAPP' },
        { $set: { text, isActive: true, verifiedBy: 'seed-script' } },
        { upsert: true }
      );
      count += 1;
    }
  }
  console.log(`[seed] upserted ${count} templates (from messageCatalog.js)`);
}

async function run() {
  await connectDB();
  const departments = await seedDepartments();
  await seedStaff(departments);
  await seedTemplates();
  await disconnectDB();
  console.log('[seed] done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
