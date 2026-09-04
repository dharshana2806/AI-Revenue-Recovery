const mongoose = require('mongoose');

/**
 * Idempotency ledger for incoming Razorpay webhooks.
 *
 * Razorpay retries webhook delivery on timeout/non-200 responses, which
 * means the SAME event (same razorpay_payment_id + event type) can
 * arrive more than once. Without this check, a retried payment.captured
 * event would re-append duplicate agent log entries and could double-fire
 * any future side effects (e.g. a notification).
 *
 * We enforce a uniqueness constraint at the DATABASE level (not just an
 * in-memory check) on (paymentId + event), so even concurrent duplicate
 * requests can't both slip through a race condition.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true },
    event: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index: the same (paymentId, event) pair can only exist once.
webhookEventSchema.index({ paymentId: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
