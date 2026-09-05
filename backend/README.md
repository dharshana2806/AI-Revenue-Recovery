# SmartRecover Backend

Express + MongoDB API powering the failed-payment recovery loop and the B2B invoice negotiation layer, built on the Razorpay Node SDK.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `MONGO_URI` | A MongoDB connection string (e.g. a free MongoDB Atlas cluster) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys, **Test Mode** |
| `RAZORPAY_WEBHOOK_SECRET` | Set when you configure the webhook (see below). Optional — without it, signature verification is skipped |
| `PORT` | Defaults to 5000 |
| `LLM_API_KEY` | Optional. Without it, recovery/negotiation messages use a fixed template instead of an LLM call |

## Run

```bash
npm run seed          # optional: populate sample transactions
npm run seed:invoices # optional: populate sample invoices
npm start              # http://localhost:5000
```

`npm run dev` runs the same thing under `nodemon` for auto-restart on file changes.

## Data model

**Transaction** (`models/Transaction.js`) — one payment attempt.
Status flow: `created → failed → recovery_link_sent → recovered` (or `abandoned` if never recovered).

**Invoice** (`models/Invoice.js`) — one B2B invoice.
Status flow: `sent → overdue → negotiating → partial_payment_enabled → paid`.

**WebhookEvent** (`models/WebhookEvent.js`) — idempotency ledger. A unique index on `(paymentId, event)` ensures a retried Razorpay webhook delivery can't be processed twice.

## Why payment status is checked against the Payment Link, not the order

`POST /:orderId/recover` creates a Razorpay **Payment Link**, not a payment against the original order. When a customer pays that link, Razorpay creates its *own* internal order behind the scenes — a different ID from the order created in `POST /api/orders`. Two consequences follow from that:

1. `GET /:orderId/check-status` fetches the payment link itself (`razorpay.paymentLink.fetch(recoveryLinkId)`), which returns a `payments` array with the real payment status, rather than asking the original order for payments (which will always come back empty for a recovery payment).
2. The payment link is created with `notes: { originalOrderId }`. Razorpay copies `notes` onto the resulting payment, so the webhook handler can reliably map an incoming `payment.captured`/`payment.failed` event back to the correct Transaction via `payment.notes.originalOrderId`, falling back to `payment.order_id` for payments made on the original order directly (e.g. through `checkout.html`).

## Setting up the Razorpay webhook (optional)

Webhooks are optional — the manual `check-status` endpoint works without one. To enable automatic updates:

```bash
npx localtunnel --port 5000
# or: ngrok http 5000
```

In Razorpay Dashboard → Settings → Webhooks:
- URL: `https://<your-tunnel-url>/api/webhooks/razorpay`
- Active events: `payment.captured`, `payment.failed`
- Copy the generated **Webhook Secret** into `RAZORPAY_WEBHOOK_SECRET` in `.env`

You can also test the webhook path without a real payment or a public tunnel using `simulate_webhook.js` (signs and posts a synthetic event straight to your local server):

```bash
node simulate_webhook.js captured <paymentId> <realOrderId> <amountInPaise>
```

## API reference

### Orders (failed-payment recovery)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/orders` | Create a Razorpay order + Transaction record. Body: `{ customerName, customerEmail, amount }` (amount in rupees) |
| POST | `/api/orders/:orderId/simulate-failure` | Manually mark the order failed with a given error code. Body: `{ errorCode }` |
| POST | `/api/orders/:orderId/recover` | Generate a recovery Payment Link + AI-drafted message |
| GET | `/api/orders/:orderId/check-status` | Ask Razorpay directly whether the recovery link has been paid; updates the Transaction to `recovered` if so |
| GET | `/api/orders` | List all transactions |

### Invoices (NegotiatorX)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/invoices` | Create a Razorpay invoice (partial payments enabled) + risk score. Body: `{ clientName, clientEmail, amount, dueDate, daysOverdue }` |
| GET | `/api/invoices/reply-options` | List the canned client-reply options used by the demo control |
| POST | `/api/invoices/:id/simulate-reply` | Record a canned client reply and have the agent decide an action |
| POST | `/api/invoices/:id/restructure` | Execute the decided action (e.g. enable partial payments with a risk-scaled, capped discount) |
| GET | `/api/invoices` | List all invoices |

### Other

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/metrics` | Revenue at risk / recovered, recovery rate, successful interventions — aggregated from all Transactions currently in the database |
| POST | `/api/webhooks/razorpay` | Razorpay calls this on `payment.captured` / `payment.failed` |
| GET | `/api/config` | Returns the public Razorpay key ID for the frontend checkout widget |

## Testing the recovery loop manually

```bash
# 1. Create an order
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Test User","customerEmail":"test@example.com","amount":499}'

# 2. Simulate a failure (use the order.id returned above)
curl -X POST http://localhost:5000/api/orders/<ORDER_ID>/simulate-failure \
  -H "Content-Type: application/json" \
  -d '{"errorCode":"GATEWAY_ERROR"}'

# 3. Generate a recovery link
curl -X POST http://localhost:5000/api/orders/<ORDER_ID>/recover

# Open the returned recoveryLinkUrl and pay with Razorpay's test card:
# 4111 1111 1111 1111, any future expiry, any CVV

# 4. Verify status
curl http://localhost:5000/api/orders/<ORDER_ID>/check-status

# 5. Check aggregate metrics
curl http://localhost:5000/api/metrics
```

Step 4 should show `"status": "recovered"`, and step 5 should reflect it in the totals.

## Risk scoring formula (NegotiatorX)

```
overdueScore = min(daysOverdue × 4, 60)
amountScore  = min((amountInRupees / 100000) × 40, 40)
riskScore    = round(overdueScore + amountScore)   // 0–100
```

Deliberately a transparent, fixed formula rather than a trained model — every score is reproducible and auditable from its two inputs.

## Guardrails enforced in code (`routes/invoices.js`)

- `MAX_DISCOUNT_PERCENT = 15` — the agent's risk-scaled discount proposal is always capped at this value; if the proposal exceeds it, the override is logged (`guardrail_override`) rather than silently applied.
- `MAX_APPROVAL_THRESHOLD = ₹2,00,000` — invoices above this amount are flagged for manual approval instead of having a restructure auto-applied.

## Resetting demo data

The `/api/metrics` endpoint aggregates every Transaction ever created, including leftover test runs. Before a live demo, clear the `transactions` and `invoices` collections (via `mongosh`, Compass, or Atlas UI) so the dashboard starts from ₹0.
