/**
 * Seeds a handful of realistic-looking transactions so your dashboard
 * isn't empty when judges look at it, without touching real Razorpay
 * order creation (these are just DB records for background context -
 * your LIVE demo transaction should be created fresh via the API).
 */
require('dotenv').config();
const dns = require('dns');
 dns.setServers(['8.8.8.8', '8.8.4.4']); 
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

const names = [
  'Ananya Rao', 'Vikram Shah', 'Priya Menon', 'Rahul Verma', 'Sneha Iyer',
  'Arjun Nair', 'Divya Pillai', 'Karthik Reddy', 'Meera Krishnan', 'Rohan Gupta',
];

const failureReasons = [
  { code: 'BAD_REQUEST_ERROR', reason: 'Card details entered incorrectly' },
  { code: 'GATEWAY_ERROR', reason: 'Bank server temporarily unavailable' },
  { code: 'PAYMENT_TIMED_OUT', reason: 'Payment session expired before completion' },
  { code: 'INSUFFICIENT_FUNDS', reason: 'Insufficient balance in the account' },
];

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await Transaction.deleteMany({});

  const docs = [];
  for (let i = 0; i < 25; i++) {
    const amount = Math.round((Math.random() * 4500 + 500) * 100); // ₹500 - ₹5000, in paise
    const statusRoll = Math.random();
    let status, failure;

    if (statusRoll < 0.5) {
      status = 'recovered';
      failure = randomOf(failureReasons);
    } else if (statusRoll < 0.8) {
      status = 'failed';
      failure = randomOf(failureReasons);
    } else {
      status = 'recovery_link_sent';
      failure = randomOf(failureReasons);
    }

    docs.push({
      razorpayOrderId: `order_synthetic_${i}_${Date.now()}`,
      customerName: randomOf(names),
      customerEmail: `customer${i}@example.com`,
      amount,
      status,
      failureReason: failure.code,
      failureDescription: failure.reason,
      recoveredAt: status === 'recovered' ? new Date() : null,
      agentLog: [
        { action: 'order_created', details: 'Synthetic seed record' },
        { action: 'failure_classified', details: failure.reason },
      ],
    });
  }

  await Transaction.insertMany(docs);
  console.log(`Seeded ${docs.length} synthetic transactions.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
