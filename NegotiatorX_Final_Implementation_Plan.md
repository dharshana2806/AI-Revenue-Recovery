# NegotiatorX Hybrid — Final Implementation Plan
### Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 0. Strategy in One Line
Build a **rock-solid, live-webhook-provable failed-payment recovery loop first** (guaranteed demo). Only if time remains, layer on the **B2B invoice negotiation** feature using a "Simulate Client Reply" button instead of real email parsing — you keep the impressive AI-negotiation angle without the most fragile dependency.

---

## 1. Scope: MVP Core vs Stretch Layer

### 🟢 MVP Core (must be 100% working before anything else)
**"SmartRecover" loop — In-session failed payment rescue**

- Backend creates a Razorpay test Order
- Simulate/trigger a `payment.failed` webhook
- AI agent (LLM) reads the failure reason (error code) and drafts a short recovery message + generates a new Razorpay Payment Link
- "Client" (you, on stage) opens the link, pays with Razorpay's test success card
- `payment.captured` webhook fires → backend updates DB → dashboard flips the invoice from "At Risk" to "Recovered" in real time

This is your **guaranteed 90-second live demo.** Nothing about it depends on parsing free-text replies or email delivery.

### 🟡 Stretch Layer (add only after MVP is demo-ready)
**"NegotiatorX" — B2B invoice negotiation**

- Create a Razorpay Invoice (partial payments enabled) for a synthetic overdue B2B client
- Dashboard has a **"Simulate Client Reply"** button with 2–3 canned replies (e.g., "Can't pay in full, cash tight")
- LLM agent reads the canned reply, decides to restructure the invoice into partial payments, calls Razorpay to enable/update partial payment terms, and drafts a follow-up email
- Show the invoice status change and audit log entry

Do **not** build real inbound email parsing. It's the single highest-risk, lowest-reward item in the original plan.

---

## 2. Tech Stack (locked in, based on your existing skills)

| Layer | Choice | Status |
|---|---|---|
| Backend | Node.js + Express | Mandatory |
| Database | MongoDB (Atlas) | Mandatory |
| Frontend | React or plain HTML/CSS/JS | Mandatory |
| AI Agent | LangChain.js (or direct LLM API calls — simpler, lower risk) | Mandatory |
| Payments | Razorpay Test Mode APIs (Orders, Payment Links, Invoices, Webhooks) | Mandatory |
| ML risk scoring | Simple rule-based score first; scikit-learn only if time allows | Optional |
| Notifications | Console log / mock inbox UI; real email only as a stretch nicety | Optional |
| Auth | Skip or hardcode a single demo login — don't waste time on JWT flows | Optional |
| Deployment | Render/Railway (backend) + Vercel (frontend) + Atlas (DB) | Do this early, not last |

**Cut from original plan:** full JWT auth system, cron-based invoice scanning, real bidirectional email integration, WhatsApp API. These add setup time without adding demo impact.

---

## 3. Data You Need

- **Synthetic invoices/orders**: generate ~30–50 fake records with `faker` (Python) or hardcoded JSON — mix of normal, overdue, and failed-payment cases
- **Razorpay Test Mode**: real test API keys, test webhook secret, Razorpay's test success/failure card numbers
- **Canned client replies**: 3–5 short text strings for the stretch-layer "Simulate Reply" button

---

## 4. System Workflow (MVP)

```
[Order created] → [payment.failed webhook received]
      → [Agent classifies failure reason]
      → [Agent generates new Payment Link + recovery message]
      → [Client pays via link, test success card]
      → [payment.captured webhook received]
      → [DB updated: status = Recovered]
      → [Dashboard metric: Revenue Recovered += amount]
```

## 5. System Workflow (Stretch)

```
[Overdue invoice, partial_payment: true]
      → [Click "Simulate Client Reply"]
      → [Agent reads canned reply text]
      → [Agent decides: restructure to partial payments]
      → [Calls Razorpay Invoices API to update terms]
      → [Agent drafts follow-up message]
      → [Audit log entry recorded]
      → [Dashboard updates invoice status]
```

---

## 6. Guardrails to Show Judges (keep these — they're cheap to build, high credibility payoff)

- Hard-coded max discount cap (e.g., never >15%)
- Agent can only **create** payment links/invoices — never issue refunds or move money out
- Any restructuring above a threshold amount requires a dashboard "Approve" click (Human-in-the-loop)

---

## 7. Metrics Dashboard (keep it to 4 numbers, live-updating)

1. Total Revenue At Risk
2. Total Revenue Recovered
3. Recovery Rate %
4. Number of successful AI interventions

Add **one differentiator visual** beyond these standard four — e.g., a live-scrolling "Agent Thought Log" showing its reasoning per action. This is cheap to build (just log strings to a panel) and is the single most memorable thing judges will screenshot.

---

## 8. Hour-by-Hour Build Order (assume ~30 active build hours over a 48hr hackathon)

| Hours | Task |
|---|---|
| 0–2 | Repo setup, MongoDB Atlas, Razorpay test keys, deploy skeleton (empty) app to Render/Vercel immediately |
| 2–6 | Express backend: Order creation endpoint, synthetic data seeding script |
| 6–10 | Webhook listener for `payment.failed` and `payment.captured`; test with Razorpay's webhook simulator |
| 10–14 | LLM agent: failure classification + recovery message + payment link generation (direct API call, skip LangChain if it's slow to wire up) |
| 14–18 | Frontend dashboard: metrics cards, invoice list, live status updates |
| 18–22 | Agent Thought Log panel + guardrail checks (discount cap, approval gate) |
| 22–26 | **Full MVP dry run — do this multiple times until it never breaks** |
| 26–32 | Stretch layer: Invoices API + "Simulate Reply" button + restructuring logic |
| 32–36 | Stretch dry run |
| 36–40 | Polish UI, seed final demo data, write the audit log copy to be readable |
| 40–44 | Rehearse the live demo 3+ times, script your talking points |
| 44–48 | Buffer for bugs, submission, pitch deck |

**Rule: MVP must be demo-safe by hour 26. Everything after that is bonus — never let stretch work put the MVP at risk.**

---

## 9. Demo Script (rehearse this exact sequence)

1. Open dashboard — show "Revenue At Risk" with a few failed payments
2. Trigger/simulate a payment failure live
3. Point at the Agent Thought Log as it reasons and generates a link
4. Open the link, pay with test card `4111 1111 1111 1111`
5. Switch back to dashboard — show the webhook hit, status flip, and the metric counter move in real time
6. *(If stretch built)* Show one B2B invoice negotiation cycle via the Simulate Reply button

Keep this under 3 minutes. Practice it so it survives Wi-Fi hiccups — have a pre-recorded backup video just in case.

---

## 10. What NOT to Build

- Real email/WhatsApp sending
- JWT auth flows
- Cron-based scanning (manual trigger button is fine for a demo)
- scikit-learn risk model (a simple weighted formula is indistinguishable to judges and 10x faster to build)
- Bidirectional email parsing of real replies
