# Deployment Guide

Goal: get a **public URL** for both backend and frontend so judges can access it independent of your laptop, and so Razorpay webhooks work without a tunnel.

---

## Part 1: Deploy the Backend (Render)

1. Push `smartrecover-backend` to a GitHub repo (create one if you haven't):
   ```bash
   cd smartrecover-backend
   git init
   git add .
   git commit -m "Initial SmartRecover backend"
   git branch -M main
   git remote add origin https://github.com/<your-username>/smartrecover-backend.git
   git push -u origin main
   ```
   **Important:** make sure `.env` is in `.gitignore` (see below) — never commit real API keys.

2. Create `.gitignore` in the backend folder if it doesn't exist:
   ```
   node_modules/
   .env
   ```

3. Go to [render.com](https://render.com), sign up free, click **New → Web Service**

4. Connect your GitHub repo

5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

6. Add Environment Variables (Render dashboard → Environment tab) — paste in the same values from your local `.env`:
   - `MONGO_URI`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `LLM_API_KEY` (optional)

7. Click **Deploy**. Wait a few minutes. You'll get a URL like:
   ```
   https://smartrecover-backend.onrender.com
   ```

8. Test it: visit `https://smartrecover-backend.onrender.com` in a browser — you should see the same `{"status":"SmartRecover backend is running"}` response.

> **Free tier note:** Render's free instances sleep after 15 min of inactivity and take ~30-60 seconds to wake up on the next request. **Hit your backend URL a few minutes before you go on stage** so it's already warm.

---

## Part 2: Update the Webhook URL

Now that you have a permanent backend URL, update Razorpay:

1. Razorpay Dashboard → Settings → Webhooks
2. Edit (or create) the webhook: URL = `https://smartrecover-backend.onrender.com/api/webhooks/razorpay`
3. Active events: `payment.captured`, `payment.failed`
4. Copy the webhook secret shown, confirm it matches what's in your Render environment variables

You no longer need `ngrok`/`localtunnel` — this URL is permanent.

---

## Part 3: Deploy the Frontend (Vercel)

1. In `smartrecover-frontend/app.js`, change the API base to your live backend URL:
   ```js
   const API_BASE = 'https://smartrecover-backend.onrender.com/api';
   ```
   (Replace localhost — this is the one line you must not forget.)

2. Push the frontend folder to its own GitHub repo the same way as the backend.

3. Go to [vercel.com](https://vercel.com), sign up free, click **Add New → Project**

4. Import the frontend repo. Since it's plain static HTML/CSS/JS, Vercel will auto-detect it — no build settings needed. Just deploy.

5. You'll get a URL like:
   ```
   https://smartrecover-frontend.vercel.app
   ```

6. Open that URL — your dashboard should load and pull live data from the Render backend.

---

## Part 4: Final Pre-Demo Checklist (Deployed Version)

- [ ] Visit backend URL directly — confirm it responds
- [ ] Visit frontend URL — confirm metrics load (not stuck on ₹0 forever — give Render ~30s to wake up)
- [ ] Run the **full demo script** against the deployed URLs, not localhost, at least once
- [ ] Re-confirm the Razorpay webhook URL points to the Render URL, not `localhost` or an old tunnel
- [ ] Bookmark both URLs so you're not typing them live on stage

---

## If You're Short on Time Before the Deadline

Deployment is valuable but **not worth risking your working local demo** if you're down to the last couple hours. A flawless localhost demo beats a broken deployed one. Priority order:

1. Working local demo (done ✅)
2. Pitch script rehearsed (done ✅)
3. Deployment (this doc) — do this **only if you have comfortable time left**
4. Polish/extra features — last priority

If you do deploy, **keep your local setup working too** as a fallback in case the free-tier backend is asleep or slow when you go on stage.
