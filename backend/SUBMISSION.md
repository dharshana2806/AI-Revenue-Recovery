# SmartRecover — Submission Write-Up
### Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## Tagline
An AI agent that recovers revenue lost to failed payments and overdue invoices — live, not just in a report.

---

## The Problem

Businesses lose money quietly, every day, in ways that never show up until a monthly finance report:

- **Failed payments** — a card declines or a bank times out mid-checkout, and the customer just leaves
- **Overdue B2B invoices** — clients ignore generic reminder emails for weeks while cash flow tightens
- **Subscription dunning failures** — an auto-renewal silently fails on an expired card, and the customer churns without anyone noticing

By the time a human looks at a report, the money is already gone.

---

## Our Solution

**SmartRecover** is an AI agent that sits between a merchant's systems and Razorpay, constantly watching for financial leakage and acting on it immediately — not after a human reviews a dashboard.

It has two "brains":
- **Analytical brain** — a transparent, explainable risk-scoring formula (days overdue + amount), not a black-box model, so every decision is auditable
- **Communication brain** — an LLM that reads context and drafts personalized recovery messages or B2B negotiation terms

Every action the agent takes is logged to an audit trail and constrained by hard-coded guardrails, because this system touches real money.

---

## How It Works (Live Demo Flow)

1. A payment fails → webhook fires
2. Agent classifies the failure reason
3. Agent generates a fresh Razorpay Payment Link + a personalized recovery message
4. Customer pays via the link
5. Razorpay webhook confirms the payment
6. Dashboard updates in real time — Revenue at Risk becomes Revenue Recovered

For B2B invoices, the same agent can negotiate: read a client's response, decide whether to extend the deadline or restructure into partial payments, and execute that via Razorpay's Invoices API — always within a discount cap and a human-approval threshold for large amounts.

---

## Razorpay APIs Used

- **Orders API** — create test-mode orders
- **Payment Links API** — generate recovery payment links dynamically
- **Invoices API** (with partial payments) — B2B invoice negotiation
- **Webhooks** — `payment.captured`, `payment.failed` for real-time status updates

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | MongoDB |
| Frontend | HTML/CSS/JavaScript |
| AI/Agent | Rule-based risk scoring + LLM (Claude) for message generation |
| Payments | Razorpay Test Mode APIs |
| Deployment | Render (backend), Vercel (frontend) |

---

## Guardrails (Why This Is Safe to Demo)

- **Discount cap**: the agent can never offer more than 15% off an invoice — and when its risk-scaled proposal exceeds that, the override is visibly logged (not silently clamped) so the dashboard shows the exact moment the hard-coded constraint won over the agent's own suggestion
- **Action boundaries**: the agent can only create payment links and invoices — it has no ability to move money out or issue refunds
- **Human-in-the-loop**: any invoice restructuring above ₹2,00,000 pauses for manual approval before the agent acts
- **Full audit trail**: every agent decision — what it detected, what it decided, what it did — is logged and visible on the dashboard
- **Webhook idempotency**: Razorpay can retry webhook delivery; a database-level unique constraint on (payment ID, event type) guarantees each event is only ever processed once, even under concurrent duplicate delivery

---

## What's Working Today

- ✅ Full failed-payment recovery loop, live end-to-end with real Razorpay test webhooks
- ✅ AI agent that classifies failures, drafts messages, and generates recovery links
- ✅ B2B invoice negotiation with risk scoring and partial payment restructuring
- ✅ Guardrails enforced in code, not just described in slides
- ✅ Live dashboard with metrics and an auditable agent thought log

---

## Impact / Metrics We Track

- Total Revenue At Risk
- Total Revenue Recovered
- Recovery Rate (%)
- Number of Successful Interventions

*(Fill in your actual demo numbers here once you've run through the flow — real figures land far better than a description.)*

---

## What We'd Build Next

- Real inbound email parsing to replace the "Simulate Client Reply" demo control
- ML-based risk model trained on real historical payment data (currently uses a transparent weighted formula by design)
- WhatsApp/SMS notification channels alongside the current messaging layer
- Multi-tenant merchant accounts with proper authentication

---

## Team

*(Add your team name and members here)*

## Links

- Live demo: *(your Vercel frontend URL)*
- Backend API: *(your Render backend URL)*
- GitHub repo: *(your repo link)*
- Demo video: *(if required by the platform)*
