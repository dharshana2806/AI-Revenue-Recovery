# SmartRecover

AI-assisted recovery for failed payments and overdue B2B invoices, built on Razorpay.

## What it does

Payments fail — cards decline, banks time out, gateways error out — and once a payment fails, most systems simply log it and stop. SmartRecover picks up from there:

- **Recovery Agent** — when a payment fails, classifies the failure reason, generates a fresh Razorpay Payment Link, and drafts a short recovery message for the customer. When the customer pays, the transaction is verified directly against Razorpay and marked recovered.
- **NegotiatorX** — for overdue B2B invoices, scores risk from the amount and days overdue, interprets the client's response, and proposes a bounded settlement (e.g. splitting the invoice into partial payments) instead of a generic reminder.

A live dashboard tracks revenue at risk, revenue recovered, recovery rate, and successful interventions, plus a per-transaction agent log showing every decision the system made and why.

## Project structure

```
backend/
  models/            Transaction, Invoice, WebhookEvent (Mongoose schemas)
  routes/            orders, invoices, webhooks, metrics
  services/
    recoveryAgent.js     failure classification + recovery message drafting
    negotiationAgent.js  risk scoring + negotiation message drafting
    prompts.js           LLM prompt templates (isolated from business logic)
    razorpayClient.js    Razorpay SDK instance
  scripts/           seed data for demo purposes
  server.js
frontend/
  index.html / app.js / style.css   main dashboard
  checkout.html / checkout.js       real Razorpay checkout widget flow
```

## Quick start

```bash
cd backend
npm install
cp .env.example .env      # fill in MongoDB + Razorpay test-mode keys
npm run seed && npm run seed:invoices   # optional: populate sample data
npm start
```

Then open `frontend/index.html` in a browser. See `backend/README.md` for full setup, environment variables, and API reference.

## How payment status is verified

A recovery payment is made through a Razorpay **Payment Link**, which is a separate object from the original order — Razorpay generates its own internal order for whatever is paid through the link. Because of that, the app checks status against the payment link itself (`razorpay.paymentLink.fetch`) rather than the original order, and stamps the original order ID into the payment link's `notes` so a Razorpay webhook (if configured) can also match it back correctly. This is also why polling the original order for payments will never show a recovery payment — it's by design in Razorpay's data model, not a bug in this app.

Two ways the app finds out a recovery payment succeeded:
- **Manual check** — the "Check Payment Status" button calls the backend, which asks Razorpay directly whether the payment link has a captured payment. This works with no extra setup and is what the demo relies on.
- **Webhook** — if you configure a Razorpay webhook pointing at `/api/webhooks/razorpay` (needs a publicly reachable URL, e.g. via a tunnel in local dev), the same update happens automatically when Razorpay calls back. Incoming webhook events are deduplicated at the database level, so Razorpay's automatic retries can't double-count a recovery.

## What's real vs. what's a demo control

**Real, no simulation:**
- Order creation, Payment Links, and Invoices are all live Razorpay Test Mode API calls.
- Payment status is verified by asking Razorpay directly (payment link fetch), not assumed from a local state change.
- `checkout.html` opens Razorpay's actual checkout widget end to end.

**Deliberately manual, by design:**
- "Simulate Payment Failure" — a manual trigger standing in for waiting on a real bank decline, so a failure can happen on cue.
- "Simulate Client Reply" — a canned reply standing in for parsing a real inbound email. The negotiation logic downstream runs identically either way.

## Guardrails

- Negotiation discounts are capped at 15% in code — the agent can propose more based on risk, but the cap always wins, and an override is logged when it happens.
- Invoices above ₹2,00,000 require manual approval before a partial-payment restructure is applied.
- Every agent action (order created, failure classified, recovery link generated, payment recovered, invoice negotiated) is appended to a per-record audit log.
- If no LLM API key is configured, recovery and negotiation messages fall back to fixed templates automatically — the core loop doesn't depend on an LLM being available.

## Known limitations

- Risk scoring is a deterministic formula (days overdue + invoice amount), not a learned model — this is a design choice for auditability, not a stand-in for one.
- "Simulate Client Reply" uses a fixed set of canned responses rather than parsing free-text replies.
- Real-time updates depend on either clicking "Check Payment Status" or having a webhook configured with a public URL — there's no polling loop running automatically in the background.
