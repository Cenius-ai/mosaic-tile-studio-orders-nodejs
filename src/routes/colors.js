'use strict';

const express = require('express');

const { db } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { getCommission } = require('../lib/queries');
const { validateColourLine, hasErrors } = require('../lib/validate');
const { buildCommissionView } = require('../lib/commission-view');
const { sheetsFor } = require('../lib/tesserae');
const format = require('../lib/format');

const router = express.Router();

function commissionIdFrom(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.post('/commissions/:id/colors', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, commissionIdFrom(req.params.id));
  if (!commission) return next();

  const { values, errors } = validateColourLine(req.body);
  if (hasErrors(errors)) {
    return res.status(400).render('commissions/show', {
      pageTitle: commission.title,
      colourDraft: values,
      colourErrors: errors,
      ...buildCommissionView(db, commission),
    });
  }

  const nextOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM tesserae_lines WHERE commission_id = ?')
    .get(commission.id).next_order;

  db.prepare(`
    INSERT INTO tesserae_lines (commission_id, colour_name, hex, material, tessera_mm, tesserae_count, sheets_reserved, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    commission.id,
    values.colour_name,
    values.hex,
    values.material,
    values.tessera_mm === '' ? null : Number(values.tessera_mm),
    Number(values.tesserae_count),
    nextOrder,
  );

  const sheets = sheetsFor(Number(values.tesserae_count), values.material);
  req.flash(
    'success',
    `${values.colour_name} added — ${format.number(values.tesserae_count)} tesserae, ${sheets} ${format.plural(sheets, 'sheet')}.`,
  );
  return res.redirect(`/commissions/${commission.id}`);
});

router.post('/commissions/:id/colors/:colorId/delete', requireAuth, (req, res, next) => {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, commissionIdFrom(req.params.id));
  if (!commission) return next();

  const lineId = Number(req.params.colorId);
  const line = db
    .prepare('SELECT * FROM tesserae_lines WHERE id = ? AND commission_id = ?')
    .get(Number.isInteger(lineId) ? lineId : -1, commission.id);
  if (!line) return next();

  db.prepare('DELETE FROM tesserae_lines WHERE id = ? AND commission_id = ?').run(line.id, commission.id);

  const reserved = Number(line.sheets_reserved) || 0;
  req.flash(
    'success',
    reserved > 0
      ? `${line.colour_name} removed. Its ${reserved} reserved ${format.plural(reserved, 'sheet')} stay out of the glass room — adjust the lot if you need them back.`
      : `${line.colour_name} removed from the palette.`,
  );
  return res.redirect(`/commissions/${commission.id}`);
});

module.exports = router;
