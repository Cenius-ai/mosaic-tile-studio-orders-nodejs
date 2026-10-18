'use strict';

const { totalsFor, withSheetMath } = require('./tesserae');

/**
 * Every query here takes the signed-in studio's user id and filters by it.
 * A row that belongs to another studio must behave exactly like a missing row.
 */

function getCommission(db, userId, commissionId) {
  if (!Number.isInteger(commissionId)) return null;
  return db
    .prepare('SELECT * FROM commissions WHERE id = ? AND user_id = ?')
    .get(commissionId, userId);
}

function listCommissions(db, userId) {
  return db
    .prepare('SELECT * FROM commissions WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(userId);
}

function recentCommissions(db, userId, limit = 4) {
  return db
    .prepare('SELECT * FROM commissions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(userId, limit);
}

function statusCounts(db, userId) {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS count FROM commissions WHERE user_id = ? GROUP BY status')
    .all(userId);
  const counts = { quoted: 0, in_progress: 0, completed: 0, total: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.total += row.count;
  }
  return counts;
}

/** Current workshop stage for every commission that is not yet completed. */
function stagesInProgress(db, userId) {
  return db
    .prepare(`
      SELECT c.id AS commission_id, c.title, c.client_name, c.status AS commission_status, c.due_date,
             s.label, s.stage_key, s.started_at
      FROM commissions c
      JOIN stage_events s ON s.commission_id = c.id AND s.status = 'active'
      WHERE c.user_id = ? AND c.status <> 'completed'
      ORDER BY (c.due_date IS NULL), c.due_date, c.id
    `)
    .all(userId);
}

function listStockLots(db, userId) {
  return db
    .prepare('SELECT * FROM stock_lots WHERE user_id = ? ORDER BY material, colour_name COLLATE NOCASE')
    .all(userId);
}

function getStockLot(db, userId, lotId) {
  if (!Number.isInteger(lotId)) return null;
  return db.prepare('SELECT * FROM stock_lots WHERE id = ? AND user_id = ?').get(lotId, userId);
}

function findStockLotByColour(db, userId, material, colourName) {
  return db
    .prepare('SELECT * FROM stock_lots WHERE user_id = ? AND material = ? AND colour_name = ? COLLATE NOCASE')
    .get(userId, material, colourName);
}

function lowStockLots(db, userId) {
  return db
    .prepare(`
      SELECT * FROM stock_lots
      WHERE user_id = ? AND sheets_on_hand <= low_stock_threshold
      ORDER BY sheets_on_hand ASC, colour_name COLLATE NOCASE ASC
    `)
    .all(userId);
}

function stockSummary(db, userId) {
  const rows = db
    .prepare('SELECT material, COUNT(*) AS lots, SUM(sheets_on_hand) AS sheets FROM stock_lots WHERE user_id = ? GROUP BY material')
    .all(userId);
  const summary = { smalti: { lots: 0, sheets: 0 }, vitreous: { lots: 0, sheets: 0 } };
  for (const row of rows) {
    summary[row.material] = { lots: row.lots, sheets: row.sheets || 0 };
  }
  return summary;
}

function paletteLines(db, commissionId) {
  return db
    .prepare(`
      SELECT * FROM tesserae_lines
      WHERE commission_id = ?
      ORDER BY tesserae_count DESC, sort_order ASC, id ASC
    `)
    .all(commissionId)
    .map(withSheetMath);
}

function paletteTotals(lines) {
  return totalsFor(lines);
}

/** Palette lines for every commission of one studio, grouped by commission id. */
function paletteByCommission(db, userId) {
  const rows = db
    .prepare(`
      SELECT l.* FROM tesserae_lines l
      JOIN commissions c ON c.id = l.commission_id
      WHERE c.user_id = ?
    `)
    .all(userId);
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.commission_id)) grouped.set(row.commission_id, []);
    grouped.get(row.commission_id).push(row);
  }
  return grouped;
}

function stagesFor(db, commissionId) {
  return db
    .prepare('SELECT * FROM stage_events WHERE commission_id = ? ORDER BY sort_order ASC, id ASC')
    .all(commissionId);
}

module.exports = {
  getCommission,
  listCommissions,
  recentCommissions,
  statusCounts,
  stagesInProgress,
  listStockLots,
  getStockLot,
  findStockLotByColour,
  lowStockLots,
  stockSummary,
  paletteLines,
  paletteTotals,
  paletteByCommission,
  stagesFor,
};
