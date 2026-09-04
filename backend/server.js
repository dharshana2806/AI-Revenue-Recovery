require('dotenv').config();
 const dns = require('dns'); 
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const ordersRouter = require('./routes/orders');
const webhooksRouter = require('./routes/webhooks');
const metricsRouter = require('./routes/metrics');
const invoicesRouter = require('./routes/invoices');

const app = express();

app.use(cors());

// IMPORTANT: the webhook route needs the RAW body for signature
// verification, so we mount it BEFORE the JSON body parser and give
// it its own raw parser. All other routes use normal JSON parsing.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);
app.use(express.json());

app.use('/api/orders', ordersRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/invoices', invoicesRouter);

app.get('/', (req, res) => {
  res.json({ status: 'SmartRecover backend is running' });
});

// Exposes only the PUBLIC key (never the secret) so the frontend can
// open Razorpay's real checkout widget.
app.get('/api/config', (req, res) => {
  res.json({ razorpayKeyId: process.env.RAZORPAY_KEY_ID });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI) 
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
