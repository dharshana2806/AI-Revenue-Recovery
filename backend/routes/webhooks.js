const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Transaction = require('../models/Transaction');
const WebhookEvent = require('../models/WebhookEvent');
const { classifyFailure } = require('../services/recoveryAgent');

/**
 * POST /api/webhooks/razorpay
 * Listens for Razorpay events: payment.captured, payment.failed.
 *
 * IMPORTANT: this route must receive the RAW body (not JSON-parsed) to
 * verify the signature. See server.js for how that's wired up.
 *
 * IDEMPOTENCY: Razorpay retries webhook delivery if it doesn't get a
 * timely 200 response, so the same payment event can arrive more than
 * once. Before running any recovery logic, we try to INSERT a
 * (paymentId, event) record into WebhookEvent, which has a unique
 * index on that pair. If the insert fails with a duplicate-key error,
 * we know this exact event was already processed and we short-circuit
 * — no duplicate agent log entries, no double side effects. This check
 * happens at the database level, so it's safe even under concurrent
 * duplicate requests, not just sequential ones.
 */
router.post('/razorpay', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body) // raw buffer
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('Webhook signature mismatch');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const payload = JSON.parse(req.body.toString());
    const event = payload.event;

    if (event === 'payment.captured' || event === 'payment.failed') {
      const payment = payload.payload.payment.entity;
      const paymentId = payment.id;

      // --- Idempotency gate ---
      try {
        await WebhookEvent.create({ paymentId, event });
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate key = this exact (paymentId, event) was already processed.
          console.log(`↩️  Duplicate webhook ignored: ${event} for ${paymentId}`);
          return res.json({ status: 'ok', duplicate: true });
        }
        throw err;
      }
      // --- End idempotency gate — safe to process below ---

      const orderId = payment.order_id;
      const transaction = await Transaction.findOne({ razorpayOrderId: orderId });

      if (transaction && event === 'payment.captured') {
        transaction.status = 'recovered';
        transaction.recoveredPaymentId = payment.id;
        transaction.recoveredAt = new Date();
        transaction.agentLog.push({
          action: 'payment_recovered',
          details: `Payment ${payment.id} captured - ₹${(payment.amount / 100).toFixed(2)} recovered`,
        });
        await transaction.save();
        console.log(`✅ Recovered: order ${orderId}`);
      }

      if (transaction && event === 'payment.failed' && transaction.status !== 'failed') {
        const classification = classifyFailure(payment.error_code);

        transaction.status = 'failed';
        transaction.failureReason = classification.errorCode;
        transaction.failureDescription = classification.reason;
        transaction.agentLog.push({
          action: 'failure_classified',
          details: `[REAL webhook] ${classification.reason} -> ${classification.suggestedFix}`,
        });
        await transaction.save();
        console.log(`⚠️ Real failure recorded: order ${orderId}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
