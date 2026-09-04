/**
 * The "AI Agent" for SmartRecover.
 *
 * Step 1: classifyFailure() - rule-based classification of the Razorpay
 *         error code into a human-friendly reason + suggested fix.
 *         (This is your transparent, explainable "risk/reason engine" -
 *          judges like that it's auditable, not a black box.)
 *
 * Step 2: generateRecoveryMessage() - drafts a short, personalized
 *         recovery message. Uses an LLM if LLM_API_KEY is set,
 *         otherwise falls back to a smart template so the demo
 *         NEVER breaks due to a missing/expired API key.
 */

// Common Razorpay test-mode failure codes mapped to plain-English reasons
const FAILURE_MAP = {
  BAD_REQUEST_ERROR: {
    reason: 'Card details entered incorrectly',
    suggestedFix: 'Try again with correct card details, or switch to UPI',
  },
  GATEWAY_ERROR: {
    reason: 'Bank server temporarily unavailable',
    suggestedFix: 'Retry in a few minutes, or use a different payment method',
  },
  PAYMENT_TIMED_OUT: {
    reason: 'Payment session expired before completion',
    suggestedFix: 'Complete payment faster via a fresh, pre-filled link',
  },
  INSUFFICIENT_FUNDS: {
    reason: 'Insufficient balance in the account',
    suggestedFix: 'Suggest an alternative payment method (UPI/other card)',
  },
  DEFAULT: {
    reason: 'Payment could not be completed',
    suggestedFix: 'Offer a fresh payment link with alternate payment options',
  },
};

function classifyFailure(errorCode) {
  const info = FAILURE_MAP[errorCode] || FAILURE_MAP.DEFAULT;
  return {
    errorCode: errorCode || 'UNKNOWN',
    reason: info.reason,
    suggestedFix: info.suggestedFix,
  };
}

const { recoveryMessagePrompt } = require('./prompts');

async function generateRecoveryMessage({ customerName, amount, reason, recoveryUrl }) {
  const rupees = (amount / 100).toFixed(2);

  // Fallback template - always works, no external dependency
  const fallbackMessage =
    `Hi ${customerName}, we noticed your payment of ₹${rupees} didn't go through ` +
    `(${reason}). No worries - here's a fresh secure link to complete it: ${recoveryUrl}`;

  if (!process.env.LLM_API_KEY) {
    return fallbackMessage;
  }

  try {
    const prompt = recoveryMessagePrompt({ customerName, rupees, reason, recoveryUrl });

    // Example using Anthropic's API - swap for your provider of choice.
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
    return text ? text.trim() : fallbackMessage;
  } catch (err) {
    console.error('LLM generation failed, using fallback template:', err.message);
    return fallbackMessage;
  }
}

module.exports = { classifyFailure, generateRecoveryMessage };
