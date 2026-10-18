'use strict';

const express = require('express');

const { db, nowIso } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { getCommission, listCommissions, paletteByCommission } = require('../lib/queries');
const { totalsFor } = require('../lib/tesserae');
const { createStages } = require('../lib/stages');
const { validateCommission, hasErrors, parseNumber } = require('../lib/validate');
const { buildCommissionView } = require('../lib/commission-view');

const router = express.Router();

function blankCommission() {
  return {
    title: '',
    client_name: '',
    width_cm: '',
    height_cm: '',
    status: 'quoted',
    due_date: '',
    notes: '',
  };
}

/** Empty input stores NULL, a numeric input stores its value (already validated). */
function numberOf(value) {
  const numeric = parseNumber(value);
  return numeric === null ? null : numeric;
}

function commissionIdFrom(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/commissions', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const palette = paletteByCommission(db, userId);
  const commissions = listCommissions(db, userId).map((commission) => {
    const lines = palette.get(commission.id) || [];
    const totals = totalsFor(lines);
    return {
      ...commission,
      colourCount: lines.length,
      sheetTotal: totals.sheets,
      tesseraTotal: totals.tesserae,
    };
  });

  res.render('commissions/list', { pageTitle: 'Commissions', commissions });
});

router.get('/commissions/new', requireAuth, (req, res) => {
  res.render('commissions/new', { pageTitle: 'New commission', values: blankCommission(), errors: {} });
});

router.post('/commissions', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { values, errors } = validateCommission(req.body);

  if (hasErrors(errors)) {
    return res.status(400).render('commissions/new', { pageTitle: 'New commission', values, errors });
  }

  const now = nowIso();
  const create = db.transaction(() => {
    const info = db
      .prepare(`
        INSERT INTO commissions (user_id, title, client_name, width_cm, height_cm, status, due_date, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        userId,
        values.title,
        values.client_name,
        numberOf(values.width_cm),
        numberOf(values.height_cm),
        values.status,
        values.due_date || null,
        values.notes,
        now,
        now,
      );
    const id = Number(info.lastInsertRowid);
    createStages(db, id, now);
    return id;
  });

  const commissionId = create();
  req.flash('success', `“${values.title}” created — its five workshop stages are ready.`);
  return res.redirect(`/commissions/${commissionId}`);
});

router.get('/commissions/:id', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, commissionIdFrom(req.params.id));
  if (!commission) return next();

  return res.render('commissions/show', {
    pageTitle: commission.title,
    colourDraft: { colour_name: '', hex: '#bd9121', material: 'smalti', tessera_mm: '6', tesserae_count: '' },
    colourErrors: {},
    ...buildCommissionView(db, commission),
  });
});

router.get('/commissions/:id/edit', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, commissionIdFrom(req.params.id));
  if (!commission) return next();

  return res.render('commissions/edit', {
    pageTitle: `Edit ${commission.title}`,
    commission,
    values: {
      title: commission.title,
      client_name: commission.client_name,
      width_cm: commission.width_cm === null ? '' : String(commission.width_cm),
      height_cm: commission.height_cm === null ? '' : String(commission.height_cm),
      status: commission.status,
      due_date: commission.due_date || '',
      notes: commission.notes,
    },
    errors: {},
  });
});

router.post('/commissions/:id', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, commissionIdFrom(req.params.id));
  if (!commission) return next();

  const { values, errors } = validateCommission(req.body);
  if (hasErrors(errors)) {
    return res.status(400).render('commissions/edit', {
      pageTitle: `Edit ${commission.title}`,
      commission,
      values,
      errors,
    });
  }

  db.prepare(`
    UPDATE commissions
    SET title = ?, client_name = ?, width_cm = ?, height_cm = ?, status = ?, due_date = ?, notes = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    values.title,
    values.client_name,
    numberOf(values.width_cm),
    numberOf(values.height_cm),
    values.status,
    values.due_date || null,
    values.notes,
    nowIso(),
    commission.id,
    userId,
  );

  req.flash('success', `“${values.title}” saved.`);
  return res.redirect(`/commissions/${commission.id}`);
});

router.post('/commissions/:id/delete', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, commissionIdFrom(req.params.id));
  if (!commission) return next();

  db.prepare('DELETE FROM commissions WHERE id = ? AND user_id = ?').run(commission.id, userId);
  req.flash('success', `“${commission.title}” deleted with its palette and stage history.`);
  return res.redirect('/commissions');
});

module.exports = router;
