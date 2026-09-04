const API_BASE = 'http://localhost:5000/api';

let currentOrderId = null;

const $ = (id) => document.getElementById(id);

async function loadMetrics() {
  const res = await fetch(`${API_BASE}/metrics`);
  const data = await res.json();
  $('metricAtRisk').textContent = `₹${data.totalRevenueAtRisk.toLocaleString('en-IN')}`;
  $('metricRecovered').textContent = `₹${data.totalRevenueRecovered.toLocaleString('en-IN')}`;
  $('metricRate').textContent = `${data.recoveryRatePercent}%`;
  $('metricInterventions').textContent = data.successfulInterventions;
}

async function loadTransactions() {
  const res = await fetch(`${API_BASE}/orders`);
  const transactions = await res.json();

  const tbody = $('transactionsBody');
  tbody.innerHTML = '';

  transactions.slice(0, 15).forEach((t) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${t.customerName}</td>
      <td>₹${(t.amount / 100).toLocaleString('en-IN')}</td>
      <td class="status-${t.status}">${t.status.replace(/_/g, ' ')}</td>
      <td>${t.failureDescription || '—'}</td>
    `;
    tbody.appendChild(row);
  });

  // Render agent log from the most recently updated transaction
  if (transactions.length > 0) {
    renderAgentLog(transactions[0]);
  }
}

function renderAgentLog(transaction) {
  const logEl = $('agentLog');
  logEl.innerHTML = '';
  (transaction.agentLog || []).forEach((entry) => {
    const line = document.createElement('div');
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const isGuardrail = entry.action === 'guardrail_override' || entry.action === 'guardrail_triggered';

    if (isGuardrail) {
      // Visually distinct treatment: this is the exact moment a hard-coded
      // constraint overrode the agent/LLM's own proposal — the single most
      // important line for demonstrating explainable, safe AI to judges.
      line.className = 'log-line-guardrail';
      line.innerHTML =
        `<span class="log-time">[${time}]</span>` +
        `<span class="guardrail-badge">🛡 GUARDRAIL ENFORCED</span> ${entry.details}`;
    } else {
      line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-line">${entry.action}:</span> ${entry.details}`;
    }
    logEl.appendChild(line);
  });
  logEl.scrollTop = logEl.scrollHeight;
}

async function refreshAll() {
  await loadMetrics();
  await loadTransactions();
}

// --- Demo flow buttons ---

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

  currentOrderId = data.order.id;
  $('failureRow').style.display = 'flex';
  $('recoverRow').style.display = 'none';
  $('recoveryResult').style.display = 'none';

  await refreshAll();
});

$('btnSimulateFailure').addEventListener('click', async () => {
  if (!currentOrderId) return;
  const errorCode = $('errorCode').value;

  const res = await fetch(`${API_BASE}/orders/${currentOrderId}/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errorCode }),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(`Error: ${data.error}`);
    return;
  }

  $('recoverRow').style.display = 'flex';
  await refreshAll();
});

$('btnRecover').addEventListener('click', async () => {
  if (!currentOrderId) return;

  const res = await fetch(`${API_BASE}/orders/${currentOrderId}/recover`, { method: 'POST' });
  const data = await res.json();

  if (!res.ok) {
    alert(`Error: ${data.error}`);
    return;
  }

  $('recoveryResult').style.display = 'block';
  $('recoveryMessage').textContent = data.recoveryMessage;
  $('recoveryLink').href = data.paymentLink.short_url;
  $('checkStatusResult').textContent = '';

  await refreshAll();
});

$('btnCheckStatus').addEventListener('click', async () => {
  if (!currentOrderId) return;

  $('checkStatusResult').textContent = 'Checking with Razorpay...';

  const res = await fetch(`${API_BASE}/orders/${currentOrderId}/check-status`);
  const data = await res.json();

  if (!res.ok) {
    $('checkStatusResult').textContent = `Error: ${data.error}`;
    return;
  }

  if (data.transaction.status === 'recovered') {
    $('checkStatusResult').textContent = '✅ Payment confirmed! Dashboard updated.';
  } else {
    $('checkStatusResult').textContent = 'No captured payment found yet for this order.';
  }

  await refreshAll();
});

// --- NegotiatorX (B2B invoice) flow ---

let currentInvoiceId = null;
let currentDecisionAction = null;

async function loadInvoices() {
  const res = await fetch(`${API_BASE}/invoices`);
  const invoices = await res.json();

  const tbody = $('invoicesBody');
  tbody.innerHTML = '';

  invoices.slice(0, 10).forEach((inv) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${inv.clientName}</td>
      <td>₹${(inv.amount / 100).toLocaleString('en-IN')}</td>
      <td>${inv.riskScore}/100</td>
      <td class="status-${inv.status}">${inv.status.replace(/_/g, ' ')}</td>
    `;
    tbody.appendChild(row);
  });

  // Show the negotiation agent log for the most recently updated invoice
  if (invoices.length > 0) {
    renderAgentLog(invoices[0]);
  }
}

$('btnCreateInvoice').addEventListener('click', async () => {
  const clientName = $('invClientName').value;
  const clientEmail = $('invClientEmail').value;
  const amount = Number($('invAmount').value);
  const daysOverdue = Number($('invDaysOverdue').value);
  const dueDate = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName, clientEmail, amount, dueDate, daysOverdue }),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(`Error: ${data.error}`);
    return;
  }

  currentInvoiceId = data.invoice.razorpayInvoiceId;
  $('replyRow').style.display = 'flex';
  $('restructureRow').style.display = 'none';
  $('negotiationResult').style.display = 'none';
  $('approvalNotice').style.display = 'none';

  await loadInvoices();
});

$('btnSimulateReply').addEventListener('click', async () => {
  if (!currentInvoiceId) return;
  const replyKey = $('replyKey').value;

  const res = await fetch(`${API_BASE}/invoices/${currentInvoiceId}/simulate-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyKey }),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(`Error: ${data.error}`);
    return;
  }

  currentDecisionAction = data.decision.action;
  $('restructureRow').style.display = 'flex';
  $('approvalNotice').style.display = data.requiresApproval ? 'inline' : 'none';

  await loadInvoices();
});

$('btnRestructure').addEventListener('click', async () => {
  if (!currentInvoiceId || !currentDecisionAction) return;

  const res = await fetch(`${API_BASE}/invoices/${currentInvoiceId}/restructure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: currentDecisionAction }),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(`Error: ${data.error}`);
    return;
  }

  $('negotiationResult').style.display = 'block';
  $('negotiationMessage').textContent = data.invoice.negotiatedTerms;

  await loadInvoices();
});

// Poll every 4 seconds so the dashboard updates automatically once you
// pay via the recovery link and the webhook fires — no manual refresh needed.
setInterval(() => {
  refreshAll();
  loadInvoices();
}, 4000);
refreshAll();
loadInvoices();
