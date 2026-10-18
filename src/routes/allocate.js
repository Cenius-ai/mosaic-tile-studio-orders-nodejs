'use strict';

const express = require('express');

const { db, nowIso } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { getCommission } = require('../lib/queries');
const { reserveForCommission } = require('../lib/stock');

const router = express.Router();

router.post('/commissions/:id/allocate', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const id = Number(req.params.id);
  const commission = getCommission(db, userId, Number.isInteger(id) ? id : null);
  if (!commission) return next();

  const result = reserveForCommission(db, userId, commission.id, nowIso());
  req.flash(result.ok ? 'success' : 'error', result.message);
  return res.redirect(`/commissions/${commission.id}`);
});

module.exports = router;
