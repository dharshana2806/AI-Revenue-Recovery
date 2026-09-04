const API_BASE = 'http://localhost:5000/api';
const $ = (id) => document.getElementById(id);

let currentOrder = null;
let razorpayKeyId = null;

// Fetch the publishable key from backend (never hardcode secret keys in frontend)
async function fetchPublicKey() {
  const res = await fetch(`${API_BASE}/config`);
  const data = await res.json();
  razorpayKeyId = data.razorpayKeyId;
}
fetchPublicKey();

$('btnCreateOrder').addEventListener('click', async () => {
  const customerName = $('custName').value;
  const customerEmail = $('custEmail').value;
  const amount = Number($('custAmount').value);

  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerName, customerEmail, amount }),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(`Error: ${data.error}`);
    return;
  }

  currentOrder = data.order;
  $('payRow').style.display = 'flex';
});

$('btnOpenCheckout').addEventListener('click', () => {
  if (!currentOrder || !razorpayKeyId) {
    alert('Create an order first (and make sure the backend /api/config endpoint is reachable).');
    return;
  }

  const options = {
    key: razorpayKeyId,
    amount: currentOrder.amount,
    currency: currentOrder.currency,
    order_id: currentOrder.id,
    name: 'SmartRecover Demo',
    description: 'Live checkout test',
    prefill: {
      name: $('custName').value,
      email: $('custEmail').value,
    },
    handler: function (response) {
      alert('Payment succeeded! payment_id: ' + response.razorpay_payment_id);
    },
    modal: {
      ondismiss: function () {
        console.log('Checkout closed');
      },
    },
    theme: { color: '#7c5cff' },
  };

  const rzp = new Razorpay(options);

  // This event fires on a genuine decline from Razorpay's test environment —
  // and Razorpay ALSO sends a real payment.failed webhook to our backend
  // at the same time, which is what actually updates the database.
  rzp.on('payment.failed', function (response) {
    alert('Payment failed (real decline): ' + response.error.description);
  });

  rzp.open();
});
