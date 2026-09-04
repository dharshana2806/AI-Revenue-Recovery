# Demo Day Script & Troubleshooting Checklist

## Before you go on stage

- [ ] Backend running (`npm start`), no red errors in terminal
- [ ] Frontend `index.html` open in browser, dashboard shows numbers (not all zeros)
- [ ] Both `npm run seed` and `npm run seed:invoices` have been run at least once
- [ ] Internet connection confirmed working (Razorpay API calls need it)
- [ ] Razorpay test success card written down or memorized: `4111 1111 1111 1111`, any future expiry, any CVV
- [ ] **Do one full dry run within the last hour before your slot** — things drift (expired tunnel URL, laptop slept, etc.)
- [ ] Have a **backup screen-recording** of a successful full run, in case Wi-Fi dies mid-pitch

---

## The 3-Minute Live Demo Script

**[0:00–0:20] Open on the dashboard**
> "This is SmartRecover — an AI agent that recovers revenue lost to failed payments and overdue invoices, live, not just in a report."
Point at the 4 metric cards.

**[0:20–0:50] Trigger a failure**
- Click **Create Order** (use the pre-filled demo values or type new ones)
- Click **Simulate Payment Failure** → pick "Bank server unavailable"
> "In the real world this fires automatically off a Razorpay webhook. We're triggering it manually so we control the timing for the demo."

**[0:50–1:30] Show the agent reasoning**
- Click **Run AI Recovery Agent**
- Point at the **Agent Thought Log** as new lines appear
- Read the generated recovery message and point at the new payment link
> "The agent classified the failure, decided on a fix, and generated this personalized message and a fresh payment link — all in real time."

**[1:30–2:10] Prove the recovery, live**
- Open the recovery link in a new tab
- Pay with the test card `4111 1111 1111 1111`
- Switch back to the dashboard — **don't refresh**, let the polling catch it
> "Razorpay just sent our backend a webhook. Watch the dashboard—" [wait 2-4 seconds] "—there: Revenue Recovered just moved, and status flipped automatically. No manual update."

**[2:10–2:50] NegotiatorX (if time allows)**
- Switch to the invoice panel, create an invoice, simulate a "Can't pay in full" reply
- Show the agent's decision + the guardrail note if amount is large
- Click Execute, show the negotiated terms message
> "For B2B invoices, the same agent negotiates payment terms instead of just retrying — always within hard-coded guardrails, like a 15% max discount cap and human approval above ₹2 lakh."

**[2:50–3:00] Close**
> "Everything you saw — the reasoning, the guardrails, the recovery — is logged and auditable, because this touches real money."

---

## If Something Breaks Mid-Demo

| Problem | Fix |
|---|---|
| Dashboard shows all zeros | Backend probably not running or wrong `API_BASE` URL in `app.js` — check terminal for errors |
| "Create Order" button does nothing / error alert | Check Razorpay keys in `.env` are Test Mode keys, not empty placeholders |
| Payment succeeds but dashboard doesn't update | Webhook not reaching your backend — this is common on local dev without a tunnel. **Don't panic**: manually refresh the page, or just narrate "the webhook fires here in production" and show the backend terminal log instead |
| LLM message generation fails | It silently falls back to the template message — this is intentional, keep going, no one will notice |
| Wi-Fi dies entirely | Switch to your backup screen recording, keep narrating over it |

---

## What Judges Are Actually Scoring (keep this in your head)

1. **Does it actually work, live, not just in slides?** — your webhook-to-dashboard loop is your strongest asset here
2. **Is the AI doing something real, not just an if-else dressed up?** — the Agent Thought Log + risk formula + guardrails prove this
3. **Is there real business value?** — say the numbers out loud: "a 1% improvement in payment recovery is worth ₹X for a mid-size business processing ₹Y/month"
4. **Depth of Razorpay integration** — you're using Orders, Payment Links, Invoices with partial payments, and Webhooks — mention all four by name once during the pitch

---

## One-Line Pitch (memorize this)

> "SmartRecover is an AI agent that watches for failed payments and overdue invoices, diagnoses why they failed, and automatically negotiates a fix — recovering revenue that would otherwise just be written off, with hard guardrails since it's dealing with real money."
