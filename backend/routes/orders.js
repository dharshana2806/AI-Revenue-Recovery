const express = require('express');
const router = express.Router();
const razorpay = require('../services/razorpayClient');
const Transaction = require('../models/Transaction');
const { classifyFailure, generateRecoveryMessage } = require('../services/recoveryAgent');

/**
 * POST /api/orders
 * Creates a real Razorpay test-mode order + a Transaction record.
 * Body: { customerName, customerEmail, amount } (amount in rupees)
 */
router.post('/', async (req, res) => {
  try {
    const { customerName, customerEmail, amount } = req.body;
    if (!customerName || !customerEmail || !amount) {
      return res.status(400).json({ error: 'customerName, customerEmail, amount are required' });
    }

    const amountInPaise = Math.round(amount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    });

    const transaction = await Transaction.create({
      razorpayOrderId: order.id,
      customerName,
      customerEmail,
      amount: amountInPaise,
      status: 'created',
      agentLog: [{ action: 'order_created', details: `Order ${order.id} created` }],
    });

    res.json({ order, transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:orderId/simulate-failure
 * DEMO-CONTROL ENDPOINT: manually trigger a "payment failed" event
 * instead of waiting for a real bank decline. This is what your
 * "Trigger Payment Failure" button on the frontend calls.
 * Body: { errorCode } e.g. "GATEWAY_ERROR"
 */
router.post('/:orderId/simulate-failure', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { errorCode } = req.body;

    const transaction = await Transaction.findOne({ razorpayOrderId: orderId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const classification = classifyFailure(errorCode);

    transaction.status = 'failed';
    transaction.failureReason = classification.errorCode;
    transaction.failureDescription = classification.reason;
    transaction.agentLog.push({
      action: 'failure_classified',
      details: `${classification.reason} -> ${classification.suggestedFix}`,
    });
    await transaction.save();

    res.json({ transaction, classification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:orderId/recover
 * The AI agent step: generate a new RAZORPAY ORDER (not a Payment Link)
 * + a recovery message. We deliberately use Orders + the Checkout
 * widget here instead of the Payment Links API, because Razorpay
 * caps unverified test accounts at 30 lifetime payment links —
 * Orders don't have this same restriction, so this keeps the demo
 * reliable regardless of how many times you've rehearsed it.
 */
router.post('/:orderId/recover', async (req, res) => {
  try {
    const { orderId } = req.params;
    const transaction = await Transaction.findOne({ razorpayOrderId: orderId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Create a FRESH Razorpay Order for the recovery attempt (same
    // amount, new order ID) — the frontend opens this via the
    // Razorpay Checkout widget, same as checkout.html does.
    const recoveryOrder = await razorpay.orders.create({
      amount: transaction.amount,
      currency: 'INR',
      receipt: `recovery_${Date.now()}`,
    });

    const recoveryMessage = await generateRecoveryMessage({
      customerName: transaction.customerName,
      amount: transaction.amount,
      reason: transaction.failureDescription || 'a technical issue',
      recoveryUrl: `Checkout will open for order ${recoveryOrder.id}`, // no hosted link anymore — Checkout widget opens directly
    });

    transaction.status = 'recovery_link_sent';
    transaction.recoveryOrderId = recoveryOrder.id;
    transaction.recoveryMessage = recoveryMessage;
    transaction.agentLog.push({
      action: 'recovery_link_generated',
      details: `Recovery order ${recoveryOrder.id} created (Checkout widget), message drafted`,
    });
    await transaction.save();

    res.json({ transaction, recoveryOrder, recoveryMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:orderId/check-status
 * Manually polls Razorpay for the real payment status of this order.
 * This is a legitimate fallback pattern for when webhooks can't reach
 * the server (e.g. local dev without a public tunnel) — it calls
 * Razorpay's real API, not a simulation, so the result is genuine.
 */
router.get('/:orderId/check-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const transaction = await Transaction.findOne({ razorpayOrderId: orderId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // The actual payment happens on the RECOVERY order (a fresh order
    // created in /recover), not the original failed one — check that
    // if it exists, otherwise fall back to the original order ID.
    const orderToCheck = transaction.recoveryOrderId || transaction.razorpayOrderId;

    // Ask Razorpay directly: has this order actually been paid?
    const payments = await razorpay.orders.fetchPayments(orderToCheck);
    const capturedPayment = payments.items.find((p) => p.status === 'captured');

    if (capturedPayment && transaction.status !== 'recovered') {
      transaction.status = 'recovered';
      transaction.recoveredPaymentId = capturedPayment.id;
      transaction.recoveredAt = new Date();
      transaction.agentLog.push({
        action: 'payment_recovered',
        details: `[Manual status check] Payment ${capturedPayment.id} captured - ₹${(capturedPayment.amount / 100).toFixed(2)} recovered`,
      });
      await transaction.save();
    }

    res.json({ transaction, razorpayPayments: payments.items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders
 * List all transactions for the dashboard.
 */
router.get('/', async (req, res) => {
  const transactions = await Transaction.find().sort({ createdAt: -1 });
  res.json(transactions);
});

module.exports = router;