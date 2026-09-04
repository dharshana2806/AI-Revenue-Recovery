const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

/**
 * GET /api/metrics
 * Powers the 4 headline numbers on the dashboard.
 */
router.get('/', async (req, res) => {
  const all = await Transaction.find();

  const atRisk = all.filter((t) => ['failed', 'recovery_link_sent'].includes(t.status));
  const recovered = all.filter((t) => t.status === 'recovered');

  const totalAtRisk = atRisk.reduce((sum, t) => sum + t.amount, 0);
  const totalRecovered = recovered.reduce((sum, t) => sum + t.amount, 0);
  const totalEverAtRisk = totalAtRisk + totalRecovered; // denominator for recovery rate

  const recoveryRate = totalEverAtRisk > 0 ? (totalRecovered / totalEverAtRisk) * 100 : 0;

  res.json({
    totalRevenueAtRisk: totalAtRisk / 100, // convert paise -> rupees
    totalRevenueRecovered: totalRecovered / 100,
    recoveryRatePercent: Number(recoveryRate.toFixed(1)),
    successfulInterventions: recovered.length,
  });
});

module.exports = router;
