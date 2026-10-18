'use strict';

const express = require('express');

const { db } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const {
  statusCounts,
  recentCommissions,
  stagesInProgress,
  lowStockLots,
  stockSummary,
  paletteByCommission,
} = require('../lib/queries');
const { totalsFor } = require('../lib/tesserae');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  const counts = statusCounts(db, userId);
  const palette = paletteByCommission(db, userId);
  const recent = recentCommissions(db, userId, 4).map((commission) => {
    const lines = palette.get(commission.id) || [];
    const totals = totalsFor(lines);
    return { ...commission, colourCount: lines.length, sheetTotal: totals.sheets, tesseraTotal: totals.tesserae };
  });

  res.render('dashboard/index', {
    pageTitle: 'Dashboard',
    counts,
    recent,
    stages: stagesInProgress(db, userId),
    low: lowStockLots(db, userId),
    stock: stockSummary(db, userId),
  });
});

module.exports = router;
