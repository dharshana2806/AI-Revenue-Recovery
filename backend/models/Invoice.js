const mongoose = require('mongoose');

/**
 * Represents a B2B invoice sent to a client.
 * Status flow:
 *   sent -> overdue -> negotiating -> partial_payment_enabled -> paid
 */
const invoiceSchema = new mongoose.Schema(
  {
    razorpayInvoiceId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    clientEmail: { type: String, required: true },
    amount: { type: Number, required: true }, // in paise
    dueDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ['sent', 'overdue', 'negotiating', 'partial_payment_enabled', 'paid'],
      default: 'sent',
    },

    daysOverdue: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 }, // 0-100, from the weighted formula

    lastClientReply: { type: String, default: null },
    negotiatedTerms: { type: String, default: null }, // AI-drafted summary of the new arrangement

    agentLog: [
      {
        timestamp: { type: Date, default: Date.now },
        action: String,
        details: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
