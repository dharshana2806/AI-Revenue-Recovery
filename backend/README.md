# SmartRecover Backend (MVP)

AI-powered failed-payment recovery loop — Razorpay AI Buildathon, Track 3.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/<your-username>/smartrecover-backend)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/<your-username>/smartrecover-backend)

> Replace `<your-username>/smartrecover-backend` with your actual GitHub repo path once pushed — these badges let anyone spin up a live instance in one click, no local setup required.

## What this does
1. Creates a Razorpay test-mode Order
2. Lets you manually simulate a payment failure (demo-safe, no waiting on real banks)
3. An "AI agent" classifies the failure and generates a recovery Payment Link + message
4. When the customer pays via the link, Razorpay's webhook flips the transaction to "recovered"
5. `/api/metrics` powers your dashboard's 4 headline numbers

## Two ways to trigger a payment failure

**Option A — Fully real (recommended if you want zero simulation):**
Open `checkout.html` in the frontend. It creates a real order and opens Razorpay's actual checkout widget. Use test card `4000 0000 0000 0002` to trigger a genuine bank-level decline — Razorpay sends a real `payment.failed` webhook, which this backend now auto-classifies (see `routes/webhooks.js`). No simulation involved.

**Option B — Manual trigger (demo-safety fallback):**
The `/api/orders/:id/simulate-failure` endpoint / the dashboard's "Simulate Payment Failure" button. Useful if you want the failure to happen on cue during a timed pitch, or if you're demoing without a stable internet connection to reach Razorpay's checkout widget.

Both paths lead to the exact same downstream agent logic (classification → recovery link → recovery message) — the only difference is what triggers it.

## Setup (do this first — Hour 0-2 of the roadmap)

```bash
cd smartrecover-backend
npm install
cp .env.example .env
```

Fill in `.env`:
- `MONGO_URI` — create a free cluster at mongodb.com/atlas, get the connection string
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from Razorpay Dashboard → Settings → API Keys (make sure you're in **Test Mode**)
- `RAZORPAY_WEBHOOK_SECRET` — set this when you configure the webhook in the Razorpay dashboard (step below)
- `LLM_API_KEY` — optional; if omitted, recovery messages use a template fallback (still works fine for demo)

## Run it

```bash
npm run seed     # populates ~25 synthetic transactions so the dashboard isn't empty
npm start         # starts the server on http://localhost:5000
```

## Set up the Razorpay webhook (for local testing)

Razorpay needs a public URL to send webhooks to. For local dev, use a tunnel:

```bash
npx localtunnel --port 5000
# or: ngrok http 5000
```

Then in Razorpay Dashboard → Settings → Webhooks:
- URL: `https://<your-tunnel-url>/api/webhooks/razorpay`
- Active events: `payment.captured`, `payment.failed`
- Copy the generated **Webhook Secret** into your `.env`

## Test the full loop manually (before building the frontend)

```bash
# 1. Create an order
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Test User","customerEmail":"test@example.com","amount":499}'

# Copy the returned order.id, then:

# 2. Simulate a failure
curl -X POST http://localhost:5000/api/orders/<ORDER_ID>/simulate-failure \
  -H "Content-Type: application/json" \
  -d '{"errorCode":"GATEWAY_ERROR"}'

# 3. Trigger the AI recovery agent
curl -X POST http://localhost:5000/api/orders/<ORDER_ID>/recover

# This returns a recoveryLinkUrl - open it in a browser and pay using
# Razorpay's test success card: 4111 1111 1111 1111, any future expiry, any CVV.

# 4. Check metrics after paying
curl http://localhost:5000/api/metrics
```

If step 4 shows the transaction moved to "recovered" and the metrics updated — **your core demo loop works end to end.** This is the single most important milestone before you touch the frontend.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/orders` | Create a Razorpay order + transaction record |
| POST | `/api/orders/:orderId/simulate-failure` | Manually trigger a failure (demo control button) |
| POST | `/api/orders/:orderId/recover` | AI agent generates recovery link + message |
| GET | `/api/orders` | List all transactions (for dashboard table) |
| GET | `/api/metrics` | Revenue at risk / recovered / recovery rate |
| POST | `/api/webhooks/razorpay` | Razorpay calls this on payment events |

## Next steps (per the roadmap)
- Build the frontend dashboard hitting these endpoints
- Add the Agent Thought Log panel (just render each transaction's `agentLog` array)
- Once this is rock solid, move on to the NegotiatorX stretch layer
