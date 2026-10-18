'use strict';

const express = require('express');

const { db, nowIso } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { getCommission, stagesFor } = require('../lib/queries');
const { text } = require('../lib/validate');

const router = express.Router();

function numberOrNull(param) {
  const value = Number(param);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function loadStage(req) {
  const userId = req.session.user.id;
  const commission = getCommission(db, userId, numberOrNull(req.params.id));
  if (!commission) return null;
  const stages = stagesFor(db, commission.id);
  const stage = stages.find((row) => row.id === numberOrNull(req.params.stageId));
  if (!stage) return null;
  return { userId, commission, stages, stage };
}

router.post('/commissions/:id/stages/:stageId/advance', requireAuth, (req, res, next) => {
  const context = loadStage(req);
  if (!context) return next();
  const { commission, stages, stage } = context;

  if (stage.status !== 'active') {
    req.flash('error', `“${stage.label}” is not the active stage — nothing changed.`);
    return res.redirect(`/commissions/${commission.id}`);
  }

  const following = stages.find((row) => row.sort_order === stage.sort_order + 1) || null;
  const now = nowIso();

  const apply = db.transaction(() => {
    db.prepare("UPDATE stage_events SET status = 'done', completed_at = ? WHERE id = ?").run(now, stage.id);

    if (following) {
      db.prepare("UPDATE stage_events SET status = 'active', started_at = ? WHERE id = ?").run(now, following.id);
      if (commission.status === 'quoted') {
        db.prepare("UPDATE commissions SET status = 'in_progress', updated_at = ? WHERE id = ?").run(now, commission.id);
      }
      return `“${stage.label}” complete — “${following.label}” is now active.`;
    }

    db.prepare("UPDATE commissions SET status = 'completed', updated_at = ? WHERE id = ?").run(now, commission.id);
    return `“${stage.label}” complete — the commission is finished.`;
  });

  req.flash('success', apply());
  return res.redirect(`/commissions/${commission.id}`);
});

router.post('/commissions/:id/stages/:stageId/reopen', requireAuth, (req, res, next) => {
  const context = loadStage(req);
  if (!context) return next();
  const { commission, stages, stage } = context;

  if (stage.status !== 'done') {
    req.flash('error', `“${stage.label}” has not been completed — there is nothing to reopen.`);
    return res.redirect(`/commissions/${commission.id}`);
  }

  const laterDone = stages.find((row) => row.sort_order > stage.sort_order && row.status === 'done');
  if (laterDone) {
    req.flash('error', `Reopen “${laterDone.label}” first — the workshop runs the stages in order.`);
    return res.redirect(`/commissions/${commission.id}`);
  }

  const now = nowIso();
  const apply = db.transaction(() => {
    db.prepare("UPDATE stage_events SET status = 'active', completed_at = NULL WHERE id = ?").run(stage.id);
    db.prepare("UPDATE stage_events SET status = 'pending', started_at = NULL WHERE commission_id = ? AND sort_order > ?")
      .run(commission.id, stage.sort_order);
    if (commission.status === 'completed') {
      db.prepare("UPDATE commissions SET status = 'in_progress', updated_at = ? WHERE id = ?").run(now, commission.id);
    }
    return `“${stage.label}” reopened — it is the active stage again.`;
  });

  req.flash('success', apply());
  return res.redirect(`/commissions/${commission.id}`);
});

router.post('/commissions/:id/stages/:stageId/note', requireAuth, (req, res, next) => {
  const context = loadStage(req);
  if (!context) return next();
  const { commission, stage } = context;

  db.prepare('UPDATE stage_events SET note = ? WHERE id = ? AND commission_id = ?')
    .run(text(req.body.note, 280), stage.id, commission.id);

  req.flash('success', `Note saved on “${stage.label}”.`);
  return res.redirect(`/commissions/${commission.id}`);
});

module.exports = router;
