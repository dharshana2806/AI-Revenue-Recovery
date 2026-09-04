/**
 * Seeds synthetic B2B invoices so the NegotiatorX panel has background
 * data too. Run alongside seedData.js (transactions). These are DB-only
 * records — no real Razorpay invoice IDs — so your LIVE demo invoice
 * should still be created fresh via the API.
 */
require('dotenv').config();
const dns = require('dns'); 
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const { calculateRiskScore } = require('../services/negotiationAgent');

const companies = [
  'Acme Traders Pvt Ltd', 'BlueWave Logistics', 'Nimbus Retail Co',
  'Sunrise Textiles', 'Orbit Manufacturing', 'Vertex Consulting',
  'Coral Bay Exports', 'Ridgeline Systems', 'Harborview Traders', 'Zenith Supplies',
];

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await Invoice.deleteMany({});

  const docs = [];
  for (let i = 0; i < 15; i++) {
    const amount = Math.round((Math.random() * 190000 + 10000) * 100); // ₹10k - ₹200k, in paise
    const daysOverdue = Math.floor(Math.random() * 40); // 0-40 days
    const riskScore = calculateRiskScore({ daysOverdue, amount });

    let status = 'sent';
    if (daysOverdue > 0) status = 'overdue';
    if (Math.random() < 0.3) status = 'paid';

    docs.push({
      razorpayInvoiceId: `inv_synthetic_${i}_${Date.now()}`,
      clientName: randomOf(companies),
      clientEmail: `finance${i}@example.com`,
      amount,
      dueDate: new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000),
      daysOverdue,
      riskScore,
      status,
      agentLog: [
        { action: 'invoice_created', details: 'Synthetic seed record' },
        { action: 'risk_scored', details: `Risk score: ${riskScore}/100` },
      ],
    });
  }

  await Invoice.insertMany(docs);
  console.log(`Seeded ${docs.length} synthetic invoices.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
