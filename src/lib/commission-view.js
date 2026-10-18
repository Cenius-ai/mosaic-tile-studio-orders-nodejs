'use strict';

const { paletteLines, paletteTotals, stagesFor } = require('./queries');
const { STAGE_SEQUENCE } = require('./stages');

const STAGE_HINTS = Object.freeze(
  Object.fromEntries(STAGE_SEQUENCE.map((stage) => [stage.key, stage.hint])),
);

/** Everything the commission detail screen needs, in one place so errors can re-render it. */
function buildCommissionView(db, commission) {
  const lines = paletteLines(db, commission.id);
  const totals = paletteTotals(lines);
  const stages = stagesFor(db, commission.id);
  return {
    commission,
    lines,
    totals,
    stages,
    allReserved: lines.length > 0 && lines.every((line) => line.sheets_reserved > 0),
    activeStage: stages.find((stage) => stage.status === 'active') || null,
    stageHints: STAGE_HINTS,
  };
}

module.exports = { buildCommissionView };
