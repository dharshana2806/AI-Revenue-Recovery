# SmartRecover — Complete Project Bundle
### Razorpay AI Buildathon · Track 3: AI Revenue Recovery

```
backend/                → Node.js/Express + MongoDB API, AI agent logic, guardrails
  ├── NegotiatorX_API_Collection.json  → Postman collection, import directly
  ├── docs/assets/architecture.png     → System architecture diagram
  ├── services/prompts.js              → Isolated LLM prompt templates + agent persona/rules
  ├── .eslintrc.json / .prettierrc     → Linting & formatting config
  └── render.yaml                      → One-click Render deploy blueprint
frontend/               → Dashboard (index.html) + real checkout page (checkout.html)
  └── .eslintrc.json / .prettierrc     → Linting & formatting config
SmartRecover_Pitch_Deck.pptx → 9-slide pitch deck
NegotiatorX_Final_Implementation_Plan.md → Original planning document
```

## Quick Start

1. `cd backend && npm install`
2. Copy `.env.example` to `.env`, fill in your MongoDB + Razorpay Test Mode keys
3. `npm run seed && npm run seed:invoices`
4. `npm start`
5. Open `frontend/index.html` in your browser — main dashboard

Full instructions: `backend/README.md`
Demo script: `backend/DEMO_SCRIPT.md`
Deployment guide: `backend/DEPLOYMENT.md`
Submission write-up: `backend/SUBMISSION.md`

## Professional Polish Included

- **Postman collection** (`backend/NegotiatorX_API_Collection.json`) — import into Postman to test every endpoint (orders, invoices, webhooks, metrics) without touching the UI
- **Architecture diagram** (`backend/docs/assets/architecture.png`) — visual system map: Frontend → Express API → AI Agent Layer → Razorpay → MongoDB, with the full end-to-end data flow explained underneath
- **Isolated prompt templates** (`backend/services/prompts.js`) — the agent's persona and hard financial guardrails (15% discount cap, no refund promises, no fabricated data) are defined once and reused across every LLM call, decoupled from business logic in `recoveryAgent.js` / `negotiationAgent.js`
- **Lint/format configs** — `.eslintrc.json` + `.prettierrc` in both `backend/` and `frontend/`
- **One-click deploy** — `render.yaml` blueprint plus deploy badges in `backend/README.md` (update the GitHub username placeholder once you push)

## What's Real vs. What's Controlled 

**Fully real, no simulation:**
- Order creation, Checkout Widget-based recovery, Invoices — all real Razorpay Test Mode API calls
- `checkout.html` — opens Razorpay's actual checkout widget; using test card `4000 0000 0000 0002` triggers a genuine decline and a real `payment.failed` webhook
- Paying the recovery order (opened via the Checkout widget) with `4111 1111 1111 1111` triggers a real `payment.captured` webhook
- All database updates happen from real webhook events when using the checkout flow

**Deliberately controlled (by design, not a shortcut):**
- The dashboard's "Simulate Payment Failure" button — a manual trigger alternative to the real checkout, useful for timed demos or unstable Wi-Fi
- The "Simulate Client Reply" button for B2B invoices — replaces real inbound email parsing, which is high-risk to demo live. The agent's decision logic downstream is identical either way.


