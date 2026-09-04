/**
 * prompts.js — Centralized LLM prompt templates for the NegotiatorX / SmartRecover agent.
 *
 * Design rationale: prompt strings are isolated from business logic
 * (services/recoveryAgent.js, services/negotiationAgent.js) so that:
 *   - Agent persona and financial guardrails are defined in ONE place,
 *     not scattered across every function that calls the LLM
 *   - Prompts can be reviewed, versioned, and audited independently
 *     of the code that invokes them
 *   - Swapping models or tuning tone doesn't require touching business logic
 */

// The agent's persona and hard financial boundaries — included in every
// LLM call so the model is consistently constrained, not just prompted
// once and hoped to remember.
const AGENT_SYSTEM_PERSONA = `
You are a financial recovery assistant for a Razorpay merchant.
Your job is to communicate with customers and clients about payments —
never to decide financial terms on your own beyond what you're told.

STRICT RULES (never violate these, even if asked):
- Never offer a discount greater than 15%, under any circumstance.
- Never imply a refund, chargeback, or reversal of funds.
- Never guarantee outcomes ("this will definitely be approved").
- Keep messages under 45 words, warm but professional in tone.
- Never fabricate account details, transaction IDs, or dates not given to you.
- If uncertain what action to take, say the request will be reviewed by a human — do not improvise a financial decision.
`.trim();

/**
 * Prompt for SmartRecover — drafting a failed-payment recovery message.
 */
function recoveryMessagePrompt({ customerName, rupees, reason, recoveryUrl }) {
  return {
    system: AGENT_SYSTEM_PERSONA,
    user:
      `Write a short (under 40 words), warm, non-pushy payment recovery message ` +
      `for a customer named ${customerName} whose ₹${rupees} payment failed due to: ${reason}. ` +
      `Include this exact link verbatim: ${recoveryUrl}. No preamble, just the message.`,
  };
}

/**
 * Prompt for NegotiatorX — drafting a B2B negotiation / follow-up message.
 */
function negotiationMessagePrompt({ clientName, rupees, action }) {
  return {
    system: AGENT_SYSTEM_PERSONA,
    user:
      `Write a short (under 45 words), warm, professional B2B negotiation message to ${clientName} ` +
      `regarding a ₹${rupees} overdue invoice. The action taken is: ${action}. ` +
      `Tone should be empathetic but businesslike. No preamble, just the message.`,
  };
}

module.exports = {
  AGENT_SYSTEM_PERSONA,
  recoveryMessagePrompt,
  negotiationMessagePrompt,
};
