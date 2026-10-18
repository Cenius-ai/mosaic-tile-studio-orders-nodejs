'use strict';

/**
 * The single source of truth for the mural-palette sheet maths.
 * One smalti sheet carries 225 tesserae, one vitreous glass sheet carries 400.
 */
const TESSERAE_PER_SHEET = Object.freeze({ smalti: 225, vitreous: 400 });

const MATERIALS = Object.freeze(['smalti', 'vitreous']);

const MATERIAL_LABELS = Object.freeze({
  smalti: 'Smalti',
  vitreous: 'Vitreous glass',
});

function isMaterial(material) {
  return Object.prototype.hasOwnProperty.call(TESSERAE_PER_SHEET, material);
}

/** Sheets needed to cut `count` tesserae of `material` — always rounded up, you cannot buy 1.4 sheets. */
function sheetsFor(count, material) {
  if (!isMaterial(material)) {
    throw new Error(`Unknown tesserae material: ${material}`);
  }
  const tesserae = Number(count);
  if (!Number.isFinite(tesserae) || tesserae <= 0) return 0;
  return Math.ceil(tesserae / TESSERAE_PER_SHEET[material]);
}

/** Attach the computed sheet count to a stored palette line. */
function withSheetMath(line) {
  return { ...line, sheets: sheetsFor(line.tesserae_count, line.material) };
}

/** Palette totals used by the detail footer and the commission list. */
function totalsFor(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.tesserae += Number(line.tesserae_count) || 0;
      acc.sheets += sheetsFor(line.tesserae_count, line.material);
      return acc;
    },
    { tesserae: 0, sheets: 0 },
  );
}

module.exports = { TESSERAE_PER_SHEET, MATERIALS, MATERIAL_LABELS, isMaterial, sheetsFor, withSheetMath, totalsFor };
