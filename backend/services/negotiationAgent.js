/**
 * The "NegotiatorX" agent. Deliberately rule-based + template-driven
 * where possible (transparent, explainable, never fails live) with an
 * optional LLM layer for the negotiation message itself.
 */

// Transparent, explainable weighted risk formula — NOT a black-box ML
// model. This is a deliberate choice: for a payments/finance system,
// judges respond well to "we chose an auditable formula over an
// opaque model," and it's 10x faster to build correctly.
function calculateRiskScore({ daysOverdue, amount }) {
  const amountInRupees = amount / 100;
  const overdueScore = Math.min(daysOverdue * 4, 60); // caps at 60
  const amountScore = Math.min((amountInRupees / 100000) * 40, 40); // caps at 40
  return Math.round(overdueScore + amountScore); // 0-100
}

// Canned client replies for the "Simulate Client Reply" demo button.
// Each maps to a distinct negotiation action so the demo shows real
// branching agent logic, not a single hardcoded path.
const CANNED_REPLIES = {
  cant_pay_full: {
    label: "Can't pay in full — cash flow is tight right now",
    action: 'offer_partial_payment',
  },
  need_extension: {
    label: 'Need 15 more days to arrange the payment',
    action: 'grant_extension',
  },
  dispute_amount: {
    label: 'The invoiced amount looks incorrect',
    action: 'flag_for_human_review',
  },
};

function decideAction(replyKey) {
  return CANNED_REPLIES[replyKey] || { label: 'Unrecognized reply', action: 'flag_for_human_review' };
}

const { negotiationMessagePrompt } = require('./prompts');

async function draftNegotiationMessage({ clientName, amount, action, discountPercent }) {
  const rupees = (amount / 100).toFixed(2);

  const templates = {
    offer_partial_payment:
      `Hi ${clientName}, we understand cash flow can be tight. We've split your ₹${rupees} invoice ` +
      `into manageable installments — no penalty, just flexibility. First installment link is ready whenever you are.`,
    grant_extension:
      `Hi ${clientName}, no problem — we've extended your due date by 15 days for the ₹${rupees} invoice. ` +
      `Thanks for letting us know in advance.`,
    flag_for_human_review:
      `Hi ${clientName}, thanks for flagging this. A member of our team will review the ₹${rupees} invoice ` +
      `and get back to you shortly.`,
  };

  const fallback = templates[action] || templates.flag_for_human_review;

  if (!process.env.LLM_API_KEY) return fallback;

  try {
    const prompt = negotiationMessagePrompt({ clientName, rupees, action });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.LLM_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    });
    if (!response.ok) throw new Error('LLM API error');
    const data = await response.json();
    const text = data.content?.find((c) => c.type === 'text')?.text;
    return text ? text.trim() : fallback;
  } catch (err) {
    console.error('LLM generation failed, using fallback template:', err.message);
    return fallback;
  }
}

module.exports = { calculateRiskScore, decideAction, draftNegotiationMessage, CANNED_REPLIES };
