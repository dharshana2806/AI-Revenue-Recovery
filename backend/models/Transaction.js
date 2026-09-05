const mongoose = require('mongoose');

/**
 * A "Transaction" represents one purchase attempt.
 * Status flow:
 *   created -> failed -> recovery_link_sent -> recovered
 *                     \-> abandoned (if never recovered)
 */
const transactionSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },

    status: {
      type: String,
      enum: ['created', 'failed', 'recovery_link_sent', 'recovered', 'abandoned'],
      default: 'created',
    },

    failureReason: { type: String, default: null }, // razorpay error code
    failureDescription: { type: String, default: null },

    recoveryLinkId: { type: String, default: null },
    recoveryLinkUrl: { type: String, default: null },
    recoveryOrderId: { type: String, default: null }, // fresh Razorpay Order for recovery (Checkout widget)
    recoveryMessage: { type: String, default: null }, // AI-generated text

    recoveredPaymentId: { type: String, default: null },
    recoveredAt: { type: Date, default: null },

    // Audit trail: every agent decision gets appended here
    agentLog: [
      {
        timestamp: { type: Date, default: Date.now },
        action: String,
        details: String,
      },
    ],
  },
  { timestamps: true 
);

module.exports = mongoose.model('Transaction', transactionSchema);