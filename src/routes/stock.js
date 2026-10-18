'use strict';

const express = require('express');

const { db, nowIso } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const {
  listStockLots,
  getStockLot,
  findStockLotByColour,
  lowStockLots,
  stockSummary,
} = require('../lib/queries');
const { validateStockLot, parseNumber, hasErrors } = require('../lib/validate');
const format = require('../lib/format');

const router = express.Router();

function blankLot() {
  return { material: 'smalti', colour_name: '', hex: '#bd9121', sheets_on_hand: '', low_stock_threshold: '2' };
}

function renderStock(req, res, options = {}) {
  const userId = req.session.user.id;
  const lots = listStockLots(db, userId);
  res.status(options.status || 200).render('stock/index', {
    pageTitle: 'Glass room',
    lots,
    groups: {
      smalti: lots.filter((lot) => lot.material === 'smalti'),
      vitreous: lots.filter((lot) => lot.material === 'vitreous'),
    },
    summary: stockSummary(db, userId),
    low: lowStockLots(db, userId),
    values: options.values || blankLot(),
    errors: options.errors || {},
    lotErrors: options.lotErrors || {},
    lotDraft: options.lotDraft || {},
  });
}

function lotIdFrom(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/stock', requireAuth, (req, res) => renderStock(req, res));

router.post('/stock', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { values, errors } = validateStockLot(req.body);

  if (!hasErrors(errors)) {
    const existing = findStockLotByColour(db, userId, values.material, values.colour_name);
    if (existing) errors.colour_name = 'That colour already exists for this material';
  }

  if (hasErrors(errors)) {
    return renderStock(req, res, { status: 400, values, errors });
  }

  db.prepare(`
    INSERT INTO stock_lots (user_id, material, colour_name, hex, sheets_on_hand, low_stock_threshold, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    values.material,
    values.colour_name,
    values.hex,
    Number(values.sheets_on_hand),
    Number(values.low_stock_threshold || 2),
    nowIso(),
  );

  req.flash(
    'success',
    `${values.colour_name} added — ${values.sheets_on_hand} ${format.plural(values.sheets_on_hand, 'sheet')} of ${values.material === 'smalti' ? 'smalti' : 'vitreous glass'}.`,
  );
  return res.redirect('/stock');
});

router.post('/stock/:id/adjust', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const lot = getStockLot(db, userId, lotIdFrom(req.params.id));
  if (!lot) return next();

  const delta = parseNumber(req.body.delta);
  const invalid = delta === null || Number.isNaN(delta) || !Number.isInteger(delta) || delta === 0;

  if (invalid) {
    return renderStock(req, res, {
      status: 400,
      lotErrors: { [lot.id]: 'Enter a whole number of sheets to add or remove, for example 3 or -3.' },
      lotDraft: { [lot.id]: req.body.delta },
    });
  }

  const nextSheets = lot.sheets_on_hand + delta;
  if (nextSheets < 0) {
    return renderStock(req, res, {
      status: 400,
      lotErrors: {
        [lot.id]: `Only ${format.number(lot.sheets_on_hand)} ${format.plural(lot.sheets_on_hand, 'sheet')} of ${lot.colour_name} on hand — cannot remove ${format.number(Math.abs(delta))}.`,
      },
      lotDraft: { [lot.id]: req.body.delta },
    });
  }
  if (nextSheets > 100000) {
    return renderStock(req, res, {
      status: 400,
      lotErrors: { [lot.id]: 'That would take the lot over 100,000 sheets — check the number.' },
      lotDraft: { [lot.id]: req.body.delta },
    });
  }

  db.prepare('UPDATE stock_lots SET sheets_on_hand = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(nextSheets, nowIso(), lot.id, userId);

  const direction = delta > 0 ? 'added to' : 'taken from';
  req.flash(
    'success',
    `${format.number(Math.abs(delta))} ${format.plural(Math.abs(delta), 'sheet')} ${direction} ${lot.colour_name} — ${format.number(nextSheets)} on hand.`,
  );
  return res.redirect('/stock');
});

router.post('/stock/:id/delete', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const lot = getStockLot(db, userId, lotIdFrom(req.params.id));
  if (!lot) return next();

  db.prepare('DELETE FROM stock_lots WHERE id = ? AND user_id = ?').run(lot.id, userId);
  req.flash('success', `${lot.colour_name} removed from the glass room.`);
  return res.redirect('/stock');
});

module.exports = router;
