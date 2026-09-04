const express = require('express');
const router = express.Router();
const razorpay = require('../services/razorpayClient');
const Invoice = require('../models/Invoice');
const { calculateRiskScore, decideAction, draftNegotiationMessage, CANNED_REPLIES } = require('../services/negotiationAgent');

// --- Guardrails (kept simple and visible, per the plan) ---
const MAX_APPROVAL_THRESHOLD = 200000 * 100; // ₹2,00,000 in paise — above this requires human approval
const MAX_DISCOUNT_PERCENT = 15; // agent can never offer more than this

/**
 * POST /api/invoices
 * Creates a Razorpay Invoice (partial payments enabled) + local record.
 * Body: { clientName, clientEmail, amount, dueDate, daysOverdue } (amount in rupees)
 */
router.post('/', async (req, res) => {
  try {
    const { clientName, clientEmail, amount, dueDate, daysOverdue = 0 } = req.body;
    if (!clientName || !clientEmail || !amount || !dueDate) {
      return res.status(400).json({ error: 'clientName, clientEmail, amount, dueDate are required' });
    }

    const amountInPaise = Math.round(amount * 100);

    const rzpInvoice = await razorpay.invoices.create({
      type: 'invoice',
      customer: { name: clientName, email: clientEmail },
      line_items: [{ name: 'Services rendered', amount: amountInPaise, currency: 'INR', quantity: 1 }],
      partial_payment: true,
    });

    const riskScore = calculateRiskScore({ daysOverdue, amount: amountInPaise });

    const invoice = await Invoice.create({
      razorpayInvoiceId: rzpInvoice.id,
      clientName,
      clientEmail,
      amount: amountInPaise,
      dueDate: new Date(dueDate),
      daysOverdue,
      riskScore,
      status: daysOverdue > 0 ? 'overdue' : 'sent',
      agentLog: [
        { action: 'invoice_created', details: `Invoice ${rzpInvoice.id} created, partial payments enabled` },
        { action: 'risk_scored', details: `Risk score: ${riskScore}/100 (${daysOverdue} days overdue)` },
      ],
    });

    res.json({ invoice, rzpInvoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/invoices/:id/reply-options
 * Returns the canned reply choices for the demo's "Simulate Client Reply" UI.
 */
router.get('/reply-options', (req, res) => {
  res.json(CANNED_REPLIES);
});

/**
 * POST /api/invoices/:id/simulate-reply
 * DEMO-CONTROL ENDPOINT: instead of real inbound email parsing, the
 * frontend sends one of the canned reply keys. The agent then decides
 * and executes an action — same downstream logic as if it had parsed
 * a real email, just with reliable, judge-safe input.
 * Body: { replyKey } e.g. "cant_pay_full"
 */
router.post('/:id/simulate-reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { replyKey } = req.body;

    const invoice = await Invoice.findOne({ razorpayInvoiceId: id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const reply = CANNED_REPLIES[replyKey];
    if (!reply) return res.status(400).json({ error: 'Unknown reply key' });

    invoice.lastClientReply = reply.label;
    invoice.status = 'negotiating';
    invoice.agentLog.push({ action: 'client_reply_received', details: `"${reply.label}"` });

    const decision = decideAction(replyKey);
    invoice.agentLog.push({ action: 'agent_decision', details: `Decided action: ${decision.action}` });

    // --- Guardrail check: large invoices require human approval before acting ---
    if (invoice.amount > MAX_APPROVAL_THRESHOLD && decision.action === 'offer_partial_payment') {
      invoice.agentLog.push({
        action: 'guardrail_triggered',
        details: `Amount exceeds ₹2,00,000 approval threshold — awaiting human approval before restructuring`,
      });
      await invoice.save();
      return res.json({ invoice, requiresApproval: true, decision });
    }

    await invoice.save();
    res.json({ invoice, requiresApproval: false, decision });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/invoices/:id/restructure
 * Executes the negotiated action: enables/confirms partial payments on
 * the Razorpay invoice and drafts the follow-up message.
 * Body: { action } e.g. "offer_partial_payment" (from the decision above,
 * or passed after a human clicks "Approve" for large invoices)
 */
router.post('/:id/restructure', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const invoice = await Invoice.findOne({ razorpayInvoiceId: id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (action === 'offer_partial_payment') {
      // The agent PROPOSES a discount scaled to risk (higher risk = bigger
      // incentive to settle) — this can exceed the allowed cap.
      const proposedDiscount = Math.round((invoice.riskScore / 100) * 25); // can go up to 25%
      const enforcedDiscount = Math.min(proposedDiscount, MAX_DISCOUNT_PERCENT);
      const wasOverridden = proposedDiscount > enforcedDiscount;

      invoice.status = 'partial_payment_enabled';
      invoice.agentLog.push({
        action: 'invoice_restructured',
        details: `Partial payments enabled on Razorpay invoice. Discount: ${enforcedDiscount}%.`,
      });

      if (wasOverridden) {
        // This is the explicit, visible moment a hard-coded guardrail
        // overrode the agent's own proposal — logged distinctly so the
        // dashboard can highlight it (see frontend renderAgentLog).
        invoice.agentLog.push({
          action: 'guardrail_override',
          details: `Agent proposed ${proposedDiscount}% (risk-scaled), but the ${MAX_DISCOUNT_PERCENT}% hard cap forced it down to ${enforcedDiscount}%. Constraint enforced in code, not by the LLM.`,
        });
      }

      const message = await draftNegotiationMessage({
        clientName: invoice.clientName,
        amount: invoice.amount,
        action,
        discountPercent: enforcedDiscount,
      });
      invoice.negotiatedTerms = message;
    } else {
      const message = await draftNegotiationMessage({
        clientName: invoice.clientName,
        amount: invoice.amount,
        action,
      });
      invoice.negotiatedTerms = message;
      invoice.agentLog.push({ action: 'follow_up_drafted', details: `Action: ${action}` });
    }

    await invoice.save();
    res.json({ invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/invoices
 * List all invoices for the dashboard.
 */
router.get('/', async (req, res) => {
  const invoices = await Invoice.find().sort({ createdAt: -1 });
  res.json(invoices);
});

module.exports = router;
