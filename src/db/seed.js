'use strict';

const { db, migrate, nowIso } = require('./index');
const { hashPassword } = require('../lib/password');
const { createStages, STAGE_SEQUENCE } = require('../lib/stages');

/**
 * The demo studios. `cenius` is the standard evaluation account; `demo` is a second
 * studio used to show that one studio never sees another's commissions or glass.
 * Passwords are hashed through the same bcrypt helper the sign-in route verifies with.
 */
const DEMO_USERS = [
  {
    email: 'cenius@cenius.ai',
    username: 'cenius',
    password: 'cenius',
    studio_name: 'Ashgrove Mosaic Studio',
  },
  {
    email: 'demo@mosaic.studio',
    username: 'demo',
    password: 'mosaic123',
    studio_name: 'Kiln Lane Mosaic',
  },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Local calendar day `offset` days from today, as YYYY-MM-DD. */
function dayOffset(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isoOffset(days, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

const ASHGROVE_COMMISSIONS = [
  {
    title: 'Harbour Light Mosaic',
    client_name: 'Ferry Terminal Trust',
    width_cm: 180,
    height_cm: 90,
    status: 'quoted',
    due_date: dayOffset(26),
    created_at: isoOffset(-9, 10),
    updated_at: isoOffset(-2, 16),
    notes: 'North-facing lobby wall. The client wants the salt-white band to run the full 180 cm before the cobalt field starts.',
    completed_stages: 0,
    lines: [
      { colour_name: 'Cobalt 031', hex: '#2f4a8c', material: 'smalti', tessera_mm: 6, tesserae_count: 1350, sheets_reserved: 0 },
      { colour_name: 'Chalk White 011', hex: '#f1ece2', material: 'vitreous', tessera_mm: 20, tesserae_count: 1200, sheets_reserved: 0 },
      { colour_name: 'Sea Glass 214', hex: '#7fb5a8', material: 'vitreous', tessera_mm: 20, tesserae_count: 800, sheets_reserved: 0 },
      { colour_name: 'Ochre 087', hex: '#c58a2b', material: 'smalti', tessera_mm: 6, tesserae_count: 450, sheets_reserved: 0 },
    ],
  },
  {
    title: 'Kitchen Courtyard Panel',
    client_name: 'Marta & Ilya Renner',
    width_cm: 96,
    height_cm: 62,
    status: 'in_progress',
    due_date: dayOffset(9),
    created_at: isoOffset(-21, 11),
    updated_at: isoOffset(-1, 15),
    notes: 'Terracotta border cut to 20 mm; grout colour matched to the Olive field so the joints disappear.',
    completed_stages: 3,
    lines: [
      { colour_name: 'Olive 072', hex: '#6b7a3a', material: 'smalti', tessera_mm: 6, tesserae_count: 900, sheets_reserved: 4 },
      { colour_name: 'Cobalt 031', hex: '#2f4a8c', material: 'smalti', tessera_mm: 6, tesserae_count: 450, sheets_reserved: 2 },
      { colour_name: 'Terracotta 143', hex: '#b45f3f', material: 'vitreous', tessera_mm: 20, tesserae_count: 320, sheets_reserved: 1 },
    ],
  },
  {
    title: 'Chapel Aisle Lettering',
    client_name: "St Brendan's Chapel",
    width_cm: 240,
    height_cm: 60,
    status: 'completed',
    due_date: dayOffset(-14),
    created_at: isoOffset(-48, 9),
    updated_at: isoOffset(-13, 17),
    notes: 'Gold leaf lettering fixed with a lime mortar bed. Handed over with a maintenance card for the sacristy team.',
    completed_stages: 5,
    lines: [
      { colour_name: 'Gold Leaf 001', hex: '#b98b1f', material: 'smalti', tessera_mm: 6, tesserae_count: 2250, sheets_reserved: 10 },
      { colour_name: 'Deep Teal 062', hex: '#1f5d5a', material: 'vitreous', tessera_mm: 20, tesserae_count: 400, sheets_reserved: 1 },
    ],
  },
];

const ASHGROVE_STOCK = [
  { material: 'smalti', colour_name: 'Cobalt 031', hex: '#2f4a8c', sheets_on_hand: 9, low_stock_threshold: 3 },
  { material: 'smalti', colour_name: 'Ochre 087', hex: '#c58a2b', sheets_on_hand: 4, low_stock_threshold: 2 },
  { material: 'smalti', colour_name: 'Olive 072', hex: '#6b7a3a', sheets_on_hand: 3, low_stock_threshold: 2 },
  { material: 'smalti', colour_name: 'Gold Leaf 001', hex: '#b98b1f', sheets_on_hand: 2, low_stock_threshold: 3 },
  { material: 'vitreous', colour_name: 'Sea Glass 214', hex: '#7fb5a8', sheets_on_hand: 5, low_stock_threshold: 2 },
  { material: 'vitreous', colour_name: 'Chalk White 011', hex: '#f1ece2', sheets_on_hand: 12, low_stock_threshold: 4 },
  { material: 'vitreous', colour_name: 'Terracotta 143', hex: '#b45f3f', sheets_on_hand: 1, low_stock_threshold: 2 },
  { material: 'vitreous', colour_name: 'Deep Teal 062', hex: '#1f5d5a', sheets_on_hand: 6, low_stock_threshold: 2 },
];

const KILN_LANE_COMMISSIONS = [
  {
    title: 'Café Sign Panel',
    client_name: 'Rosemary Lane Coffee',
    width_cm: 62,
    height_cm: 40,
    status: 'quoted',
    due_date: dayOffset(12),
    created_at: isoOffset(-5, 12),
    updated_at: isoOffset(-5, 12),
    notes: 'Two-word sign in ochre on a chalk-white ground, to sit above the shop door.',
    completed_stages: 0,
    lines: [
      { colour_name: 'Ochre 087', hex: '#c58a2b', material: 'smalti', tessera_mm: 6, tesserae_count: 300, sheets_reserved: 0 },
      { colour_name: 'Chalk White 011', hex: '#f1ece2', material: 'vitreous', tessera_mm: 20, tesserae_count: 400, sheets_reserved: 0 },
    ],
  },
  {
    title: 'Garden Rill Mosaic',
    client_name: 'Hollow Lane Garden',
    width_cm: 120,
    height_cm: 70,
    status: 'in_progress',
    due_date: dayOffset(4),
    created_at: isoOffset(-16, 9),
    updated_at: isoOffset(-2, 11),
    notes: 'Running water channel; the sea-glass field lays dry before it is bedded on the slab.',
    completed_stages: 2,
    lines: [
      { colour_name: 'Sea Glass 214', hex: '#7fb5a8', material: 'vitreous', tessera_mm: 20, tesserae_count: 1200, sheets_reserved: 3 },
    ],
  },
];

const KILN_LANE_STOCK = [
  { material: 'vitreous', colour_name: 'Sea Glass 214', hex: '#7fb5a8', sheets_on_hand: 6, low_stock_threshold: 2 },
  { material: 'smalti', colour_name: 'Ochre 087', hex: '#c58a2b', sheets_on_hand: 3, low_stock_threshold: 2 },
  { material: 'vitreous', colour_name: 'Chalk White 011', hex: '#f1ece2', sheets_on_hand: 2, low_stock_threshold: 2 },
];

const STUDIO_DATA = {
  'cenius@cenius.ai': { commissions: ASHGROVE_COMMISSIONS, stock: ASHGROVE_STOCK },
  'demo@mosaic.studio': { commissions: KILN_LANE_COMMISSIONS, stock: KILN_LANE_STOCK },
};

function upsertUser(database, user, now) {
  const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(user.email);
  const passwordHash = hashPassword(user.password);

  if (existing) {
    database
      .prepare('UPDATE users SET username = ?, password_hash = ?, studio_name = ? WHERE id = ?')
      .run(user.username, passwordHash, user.studio_name, existing.id);
    return existing.id;
  }

  const info = database
    .prepare('INSERT INTO users (email, username, password_hash, studio_name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(user.email, user.username, passwordHash, user.studio_name, now);
  return Number(info.lastInsertRowid);
}

function clearStudioData(database, userId) {
  database
    .prepare('DELETE FROM tesserae_lines WHERE commission_id IN (SELECT id FROM commissions WHERE user_id = ?)')
    .run(userId);
  database
    .prepare('DELETE FROM stage_events WHERE commission_id IN (SELECT id FROM commissions WHERE user_id = ?)')
    .run(userId);
  database.prepare('DELETE FROM commissions WHERE user_id = ?').run(userId);
  database.prepare('DELETE FROM stock_lots WHERE user_id = ?').run(userId);
}

function insertCommission(database, userId, commission) {
  const info = database
    .prepare(`
      INSERT INTO commissions (user_id, title, client_name, width_cm, height_cm, status, due_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      userId,
      commission.title,
      commission.client_name,
      commission.width_cm,
      commission.height_cm,
      commission.status,
      commission.due_date,
      commission.notes,
      commission.created_at,
      commission.updated_at,
    );
  const commissionId = Number(info.lastInsertRowid);

  createStages(database, commissionId, commission.created_at);
  const completed = Math.min(commission.completed_stages, STAGE_SEQUENCE.length);
  const updateStage = database.prepare(
    'UPDATE stage_events SET status = ?, started_at = ?, completed_at = ? WHERE commission_id = ? AND stage_key = ?',
  );
  STAGE_SEQUENCE.forEach((stage, index) => {
    if (index < completed) {
      updateStage.run('done', isoOffset(-30 + index * 3, 9), isoOffset(-27 + index * 3, 16), commissionId, stage.key);
    } else if (index === completed) {
      updateStage.run('active', isoOffset(-30 + index * 3, 9), null, commissionId, stage.key);
    } else {
      updateStage.run('pending', null, null, commissionId, stage.key);
    }
  });

  const insertLine = database.prepare(`
    INSERT INTO tesserae_lines (commission_id, colour_name, hex, material, tessera_mm, tesserae_count, sheets_reserved, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  commission.lines.forEach((line, index) => {
    insertLine.run(
      commissionId,
      line.colour_name,
      line.hex,
      line.material,
      line.tessera_mm,
      line.tesserae_count,
      line.sheets_reserved,
      index,
    );
  });

  return commissionId;
}

/**
 * Reset the demo studios to a known state. Idempotent: running it twice leaves the
 * same row counts, and it never touches a studio that signed up on its own.
 */
function seedDatabase(database = db) {
  const now = nowIso();
  const run = database.transaction(() => {
    for (const user of DEMO_USERS) {
      const userId = upsertUser(database, user, now);
      clearStudioData(database, userId);
      const data = STUDIO_DATA[user.email];

      for (const commission of data.commissions) {
        insertCommission(database, userId, commission);
      }

      const insertLot = database.prepare(`
        INSERT INTO stock_lots (user_id, material, colour_name, hex, sheets_on_hand, low_stock_threshold, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const lot of data.stock) {
        insertLot.run(
          userId,
          lot.material,
          lot.colour_name,
          lot.hex,
          lot.sheets_on_hand,
          lot.low_stock_threshold,
          now,
        );
      }
    }
  });

  run();
  return seedSummary(database);
}

function seedSummary(database = db) {
  const users = database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const commissions = database.prepare('SELECT COUNT(*) AS count FROM commissions').get().count;
  const stages = database.prepare('SELECT COUNT(*) AS count FROM stage_events').get().count;
  const lots = database.prepare('SELECT COUNT(*) AS count FROM stock_lots').get().count;
  return { users, commissions, stages, lots };
}

/** Used on the normal boot path: a fresh clone gets demo data without a manual seed step. */
function seedIfEmpty(database = db) {
  const { count } = database.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return { seeded: false };
  return { seeded: true, ...seedDatabase(database) };
}

module.exports = { seedDatabase, seedIfEmpty, seedSummary, DEMO_USERS };

if (require.main === module) {
  migrate();
  const summary = seedDatabase(db);
  console.log(
    `Seeded ${summary.users} studios, ${summary.commissions} commissions, ${summary.stages} stage rows and ${summary.lots} glass lots.`,
  );
}
