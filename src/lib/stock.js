'use strict';

const { withSheetMath, MATERIAL_LABELS } = require('./tesserae');

/**
 * Reserve the sheets every uncovered palette line still needs — all or nothing.
 * Nothing is deducted unless every shortfall can be covered, so the glass room
 * can never silently go negative.
 */
function reserveForCommission(db, userId, commissionId, nowIso) {
  const lines = db
    .prepare(`
      SELECT * FROM tesserae_lines
      WHERE commission_id = ?
      ORDER BY tesserae_count DESC, sort_order ASC, id ASC
    `)
    .all(commissionId)
    .map(withSheetMath);

  if (lines.length === 0) {
    return { ok: false, message: 'This mural has no palette lines yet — add a colour before reserving glass.' };
  }

  const uncovered = lines.filter((line) => line.sheets_reserved === 0);
  if (uncovered.length === 0) {
    return { ok: false, message: 'Every colour line is already reserved against the glass room.' };
  }

  const findLot = db.prepare(
    'SELECT * FROM stock_lots WHERE user_id = ? AND material = ? AND colour_name = ? COLLATE NOCASE',
  );

  // Two palette lines can point at the same lot, so aggregate before checking coverage.
  const plan = new Map();
  for (const line of uncovered) {
    const lot = findLot.get(userId, line.material, line.colour_name);
    if (!lot) {
      return {
        ok: false,
        message: `No ${MATERIAL_LABELS[line.material].toLowerCase()} lot for ${line.colour_name} in the glass room — add the lot, then reserve again.`,
      };
    }
    const entry = plan.get(lot.id) || { lot, sheets: 0, lineIds: [] };
    entry.sheets += line.sheets;
    entry.lineIds.push({ id: line.id, sheets: line.sheets });
    plan.set(lot.id, entry);
  }

  for (const entry of plan.values()) {
    if (entry.sheets > entry.lot.sheets_on_hand) {
      const short = entry.sheets - entry.lot.sheets_on_hand;
      return {
        ok: false,
        message: `Not enough ${entry.lot.colour_name}: needs ${entry.sheets} ${entry.sheets === 1 ? 'sheet' : 'sheets'}, ${entry.lot.sheets_on_hand} on hand — ${short} sheet${short === 1 ? '' : 's'} short. Nothing was reserved.`,
      };
    }
  }

  const deduct = db.prepare('UPDATE stock_lots SET sheets_on_hand = ?, updated_at = ? WHERE id = ? AND user_id = ?');
  const markReserved = db.prepare('UPDATE tesserae_lines SET sheets_reserved = ? WHERE id = ?');

  const apply = db.transaction(() => {
    let sheets = 0;
    for (const entry of plan.values()) {
      deduct.run(entry.lot.sheets_on_hand - entry.sheets, nowIso, entry.lot.id, userId);
      for (const line of entry.lineIds) {
        markReserved.run(line.sheets, line.id);
        sheets += line.sheets;
      }
    }
    return sheets;
  });

  const sheets = apply();
  return {
    ok: true,
    sheets,
    lines: uncovered.length,
    message: `Reserved ${sheets} sheet${sheets === 1 ? '' : 's'} across ${uncovered.length} colour line${uncovered.length === 1 ? '' : 's'} from the glass room.`,
  };
}

module.exports = { reserveForCommission };
