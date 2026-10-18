'use strict';

/** The fixed workshop sequence every commission walks through. */
const STAGE_SEQUENCE = Object.freeze([
  { key: 'design', label: 'Design & cartoon', hint: 'Scale drawing and full-size cartoon pinned to the board.' },
  { key: 'cutting', label: 'Tesserae cutting', hint: 'Cutting smalti and vitreous to the palette sizes.' },
  { key: 'gluing', label: 'Gluing', hint: 'Fixing tesserae face-down or face-up to the substrate.' },
  { key: 'grouting', label: 'Grouting', hint: 'Pressing grout into the joints and cleaning the face.' },
  { key: 'fixing', label: 'Fixing', hint: 'Final fixing to the wall, sealing and hand-over.' },
]);

/** Insert the five stage rows for a freshly created commission; the first one starts active. */
function createStages(db, commissionId, now) {
  const insert = db.prepare(`
    INSERT INTO stage_events (commission_id, stage_key, label, status, note, started_at, completed_at, sort_order)
    VALUES (?, ?, ?, ?, '', ?, NULL, ?)
  `);
  STAGE_SEQUENCE.forEach((stage, index) => {
    const status = index === 0 ? 'active' : 'pending';
    insert.run(commissionId, stage.key, stage.label, status, status === 'active' ? now : null, index);
  });
}

module.exports = { STAGE_SEQUENCE, createStages };
