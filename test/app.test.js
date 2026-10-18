'use strict';

const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');

// A throwaway database and a fixed signing secret, set BEFORE the app is required.
const dbPath = path.join(__dirname, '..', 'data', `test-${process.pid}.db`);
process.env.STUDIO_DB = dbPath;
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

for (const suffix of ['', '-wal', '-shm']) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const { db, migrate } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const app = require('../src/app');

let server;
let base;

class Client {
  constructor() {
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  storeCookies(response) {
    const raw =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')];
    for (const header of raw || []) {
      if (!header) continue;
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      if (index === -1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async get(pathname) {
    const response = await fetch(base + pathname, {
      redirect: 'manual',
      headers: { cookie: this.cookieHeader() },
    });
    this.storeCookies(response);
    return { status: response.status, location: response.headers.get('location') || '', body: await response.text() };
  }

  async post(pathname, fields = {}) {
    const response = await fetch(base + pathname, {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: this.cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
    this.storeCookies(response);
    return { status: response.status, location: response.headers.get('location') || '', body: await response.text() };
  }
}

async function signIn(client, identifier, password) {
  return client.post('/login', { identifier, password });
}

function userIdFor(email) {
  return db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
}

function commissionIdFor(title) {
  return db.prepare('SELECT id FROM commissions WHERE title = ?').get(title).id;
}

function stageIdFor(commissionId, stageKey) {
  return db.prepare('SELECT id FROM stage_events WHERE commission_id = ? AND stage_key = ?').get(commissionId, stageKey).id;
}

function sheetsOnHand(userId, material, colourName) {
  return db
    .prepare('SELECT sheets_on_hand FROM stock_lots WHERE user_id = ? AND material = ? AND colour_name = ?')
    .get(userId, material, colourName).sheets_on_hand;
}

before(async () => {
  migrate();
  seedDatabase(db);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  try {
    db.close();
  } catch (error) {
    if (error.code !== 'SQLITE_MISUSE') throw error;
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

test('public front page renders the product and the demo credential', async () => {
  const client = new Client();
  const response = await client.get('/');
  assert.equal(response.status, 200);
  assert.match(response.body, /Mosaic Tile Studio/);
  assert.match(response.body, /Demo: cenius@cenius\.ai \/ cenius/);
  assert.match(response.body, /href="\/login"/);
});

test('protected pages redirect to sign-in when nobody is signed in', async () => {
  const client = new Client();
  for (const pathname of ['/dashboard', '/commissions', '/stock']) {
    const response = await client.get(pathname);
    assert.equal(response.status, 302, `${pathname} should redirect`);
    assert.match(response.location, /\/login$/);
  }
});

test('a wrong password shows one generic message and keeps the typed email', async () => {
  const client = new Client();
  const response = await signIn(client, 'cenius@cenius.ai', 'not-the-password');
  assert.equal(response.status, 401);
  assert.match(response.body, /Email or password is incorrect/);
  assert.match(response.body, /value="cenius@cenius\.ai"/);
  assert.doesNotMatch(response.body, /no such user|unknown email/i);
});

test('the demo studio signs in and lands on a dashboard with seeded content', async () => {
  const client = new Client();
  const response = await signIn(client, 'cenius@cenius.ai', 'cenius');
  assert.equal(response.status, 302);
  assert.match(response.location, /\/dashboard$/);

  const dashboard = await client.get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.body, /What needs your hands today/);
  assert.match(dashboard.body, /Ashgrove Mosaic Studio/);
  assert.match(dashboard.body, /Harbour Light Mosaic/);
});

test('the dashboard counts commissions by status and lists low glass', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const response = await client.get('/dashboard');

  const counts = db
    .prepare('SELECT status, COUNT(*) AS count FROM commissions WHERE user_id = ? GROUP BY status')
    .all(userIdFor('cenius@cenius.ai'));
  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row.count]));
  assert.equal(byStatus.quoted, 1);
  assert.equal(byStatus.in_progress, 1);
  assert.equal(byStatus.completed, 1);

  assert.match(response.body, /Low glass/);
  assert.match(response.body, /Gold Leaf 001/);
  assert.match(response.body, /Terracotta 143/);

  const lowLots = db
    .prepare('SELECT colour_name, sheets_on_hand FROM stock_lots WHERE user_id = ? AND sheets_on_hand <= low_stock_threshold')
    .all(userIdFor('cenius@cenius.ai'));
  assert.equal(lowLots.length, 2);
  for (const lot of lowLots) {
    assert.match(response.body, new RegExp(`${lot.colour_name}`));
    assert.match(response.body, new RegExp(`chip chip--low\">${lot.sheets_on_hand} `));
  }
});

test('creating a commission adds it to the list and gives it five stages', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');

  const created = await client.post('/commissions', {
    title: 'Harbour Light Study',
    client_name: 'Ferry Terminal Trust',
    width_cm: '40',
    height_cm: '30',
    status: 'quoted',
    due_date: '2030-05-01',
    notes: 'Bench study for the lobby panel.',
  });
  assert.equal(created.status, 302);

  const id = Number(created.location.split('/').pop());
  assert.ok(Number.isInteger(id) && id > 0);

  const list = await client.get('/commissions');
  assert.equal(list.status, 200);
  assert.match(list.body, /Harbour Light Study/);
  assert.ok(list.body.indexOf('Harbour Light Study') < list.body.indexOf('Harbour Light Mosaic'));

  const detail = await client.get(`/commissions/${id}`);
  assert.equal(detail.status, 200);
  assert.match(detail.body, /Design &amp; cartoon/);
  assert.match(detail.body, /Tesserae cutting/);
  assert.match(detail.body, /Gluing/);
  assert.match(detail.body, /Grouting/);
  assert.match(detail.body, /Fixing/);
  assert.match(detail.body, /No colours yet/);

  const stages = db.prepare('SELECT status FROM stage_events WHERE commission_id = ? ORDER BY sort_order').all(id);
  assert.equal(stages.length, 5);
  assert.equal(stages[0].status, 'active');
  assert.deepEqual(
    stages.slice(1).map((row) => row.status),
    ['pending', 'pending', 'pending', 'pending'],
  );
});

test('a blank title redisplays the form with an error and keeps the other values', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');

  const response = await client.post('/commissions', {
    title: '   ',
    client_name: 'Renner Courtyard',
    width_cm: '96',
    height_cm: '62',
    status: 'quoted',
    due_date: '',
    notes: '',
  });

  assert.equal(response.status, 400);
  assert.match(response.body, /Title is required/);
  assert.match(response.body, /value="Renner Courtyard"/);
  assert.match(response.body, /value="96"/);
});

test('non-positive dimensions are rejected with a field message', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');

  const response = await client.post('/commissions', {
    title: 'Zero Width Panel',
    client_name: '',
    width_cm: '0',
    height_cm: '30',
    status: 'quoted',
    due_date: '',
    notes: '',
  });

  assert.equal(response.status, 400);
  assert.match(response.body, /Width must be a positive number of centimetres/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM commissions WHERE title = ?').get('Zero Width Panel').count, 0);
});

test('editing a commission updates the list and the detail header', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const id = commissionIdFor('Harbour Light Study');

  const editForm = await client.get(`/commissions/${id}/edit`);
  assert.equal(editForm.status, 200);
  assert.match(editForm.body, /value="Harbour Light Study"/);

  const saved = await client.post(`/commissions/${id}`, {
    title: 'Harbour Light Study II',
    client_name: 'Ferry Terminal Trust',
    width_cm: '41',
    height_cm: '31',
    status: 'in_progress',
    due_date: '2030-05-01',
    notes: 'Widened by a centimetre after the site visit.',
  });
  assert.equal(saved.status, 302);

  const detail = await client.get(`/commissions/${id}`);
  assert.match(detail.body, /Harbour Light Study II/);
  assert.match(detail.body, /In progress/);

  const list = await client.get('/commissions');
  assert.match(list.body, /Harbour Light Study II/);
});

test('palette lines show tesserae, computed sheets and palette totals', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const id = commissionIdFor('Harbour Light Study II');

  const added = await client.post(`/commissions/${id}/colors`, {
    colour_name: 'Ochre 087',
    hex: '#c58a2b',
    material: 'smalti',
    tessera_mm: '6',
    tesserae_count: '450',
  });
  assert.equal(added.status, 302);

  const detail = await client.get(`/commissions/${id}`);
  assert.equal(detail.status, 200);
  assert.match(detail.body, /Ochre 087/);
  assert.match(detail.body, /450/);
  assert.match(detail.body, /2 sheets/);
  assert.match(detail.body, /Palette totals/);
  assert.match(detail.body, /Not reserved/);
});

test('removing a colour line recomputes the palette totals', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const id = commissionIdFor('Harbour Light Study II');

  await client.post(`/commissions/${id}/colors`, {
    colour_name: 'Sea Glass 214',
    hex: '#7fb5a8',
    material: 'vitreous',
    tessera_mm: '20',
    tesserae_count: '800',
  });

  const before = db
    .prepare('SELECT COUNT(*) AS count FROM tesserae_lines WHERE commission_id = ?')
    .get(id).count;
  assert.equal(before, 2);

  const line = db.prepare('SELECT id FROM tesserae_lines WHERE commission_id = ? AND colour_name = ?').get(id, 'Ochre 087');
  const removed = await client.post(`/commissions/${id}/colors/${line.id}/delete`);
  assert.equal(removed.status, 302);

  const detail = await client.get(`/commissions/${id}`);
  assert.doesNotMatch(detail.body, /Remove Ochre 087 from the palette/);
  assert.match(detail.body, /Remove Sea Glass 214 from the palette/);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM tesserae_lines WHERE commission_id = ?').get(id).count,
    1,
  );
});

test('reserving sheets deducts the glass room and marks every line reserved', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const userId = userIdFor('cenius@cenius.ai');
  const id = commissionIdFor('Harbour Light Mosaic');

  const cobaltBefore = sheetsOnHand(userId, 'smalti', 'Cobalt 031');
  const detailBefore = await client.get(`/commissions/${id}`);
  assert.match(detailBefore.body, /Reserve sheets from stock/);

  const reserved = await client.post(`/commissions/${id}/allocate`);
  assert.equal(reserved.status, 302);

  const detail = await client.get(`/commissions/${id}`);
  assert.match(detail.body, /Reserved 6/);
  assert.match(detail.body, /All sheets reserved/);
  assert.doesNotMatch(detail.body, /Reserve sheets from stock/);
  assert.equal(sheetsOnHand(userId, 'smalti', 'Cobalt 031'), cobaltBefore - 6);
});

test('reservation is all-or-nothing when a colour is short', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const userId = userIdFor('cenius@cenius.ai');

  const created = await client.post('/commissions', {
    title: 'Short Glass Trial',
    client_name: 'Bench test',
    width_cm: '',
    height_cm: '',
    status: 'quoted',
    due_date: '',
    notes: '',
  });
  const id = Number(created.location.split('/').pop());

  await client.post(`/commissions/${id}/colors`, {
    colour_name: 'Gold Leaf 001',
    hex: '#b98b1f',
    material: 'smalti',
    tessera_mm: '6',
    tesserae_count: '2250',
  });

  const goldBefore = sheetsOnHand(userId, 'smalti', 'Gold Leaf 001');
  const refused = await client.post(`/commissions/${id}/allocate`);
  assert.equal(refused.status, 302);

  const detail = await client.get(`/commissions/${id}`);
  assert.match(detail.body, /Not enough Gold Leaf 001/);
  assert.match(detail.body, /Nothing was reserved/);
  assert.equal(sheetsOnHand(userId, 'smalti', 'Gold Leaf 001'), goldBefore);
  assert.equal(
    db.prepare('SELECT sheets_reserved FROM tesserae_lines WHERE commission_id = ?').get(id).sheets_reserved,
    0,
  );
});

test('advancing stages completes the commission after fixing', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const id = commissionIdFor('Kitchen Courtyard Panel');

  const grouting = stageIdFor(id, 'grouting');
  const advanced = await client.post(`/commissions/${id}/stages/${grouting}/advance`);
  assert.equal(advanced.status, 302);

  let stages = db.prepare('SELECT stage_key, status FROM stage_events WHERE commission_id = ? ORDER BY sort_order').all(id);
  assert.equal(stages.find((row) => row.stage_key === 'grouting').status, 'done');
  assert.equal(stages.find((row) => row.stage_key === 'fixing').status, 'active');

  const fixing = stageIdFor(id, 'fixing');
  await client.post(`/commissions/${id}/stages/${fixing}/advance`);
  const commission = db.prepare('SELECT status FROM commissions WHERE id = ?').get(id);
  assert.equal(commission.status, 'completed');

  const dashboard = await client.get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.body, /What needs your hands today/);
  assert.match(dashboard.body, /Completed/);
  const completedCount = db
    .prepare("SELECT COUNT(*) AS count FROM commissions WHERE user_id = ? AND status = 'completed'")
    .get(userIdFor('cenius@cenius.ai')).count;
  assert.equal(completedCount, 2);

  stages = db.prepare('SELECT COUNT(*) AS done FROM stage_events WHERE commission_id = ? AND status = ?').get(id, 'done');
  assert.equal(stages.done, 5);
});

test('reopening a completed stage clears its completion time and returns the commission to in progress', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const id = commissionIdFor('Kitchen Courtyard Panel');
  const fixing = stageIdFor(id, 'fixing');

  const reopened = await client.post(`/commissions/${id}/stages/${fixing}/reopen`);
  assert.equal(reopened.status, 302);

  const stage = db.prepare('SELECT status, completed_at FROM stage_events WHERE id = ?').get(fixing);
  assert.equal(stage.status, 'active');
  assert.equal(stage.completed_at, null);
  assert.equal(db.prepare('SELECT status FROM commissions WHERE id = ?').get(id).status, 'in_progress');
});

test('glass lots can be added, adjusted and deleted', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');

  const added = await client.post('/stock', {
    material: 'vitreous',
    colour_name: 'Cobalt 031',
    hex: '#2f4a8c',
    sheets_on_hand: '12',
    low_stock_threshold: '2',
  });
  assert.equal(added.status, 302);

  const lot = db
    .prepare('SELECT * FROM stock_lots WHERE user_id = ? AND material = ? AND colour_name = ?')
    .get(userIdFor('cenius@cenius.ai'), 'vitreous', 'Cobalt 031');
  assert.ok(lot, 'the new lot exists');
  assert.equal(lot.sheets_on_hand, 12);

  const page = await client.get('/stock');
  assert.match(page.body, /Cobalt 031/);
  assert.match(page.body, /12/);

  const adjusted = await client.post(`/stock/${lot.id}/adjust`, { delta: '-3' });
  assert.equal(adjusted.status, 302);
  assert.equal(db.prepare('SELECT sheets_on_hand FROM stock_lots WHERE id = ?').get(lot.id).sheets_on_hand, 9);

  const overdraw = await client.post(`/stock/${lot.id}/adjust`, { delta: '-99' });
  assert.equal(overdraw.status, 400);
  assert.match(overdraw.body, /cannot remove 99/);
  assert.equal(db.prepare('SELECT sheets_on_hand FROM stock_lots WHERE id = ?').get(lot.id).sheets_on_hand, 9);

  const deleted = await client.post(`/stock/${lot.id}/delete`);
  assert.equal(deleted.status, 302);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_lots WHERE id = ?').get(lot.id).count, 0);
});

test('a duplicate material and colour is rejected without creating a row', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');

  const response = await client.post('/stock', {
    material: 'smalti',
    colour_name: 'Cobalt 031',
    hex: '#2f4a8c',
    sheets_on_hand: '4',
    low_stock_threshold: '2',
  });

  assert.equal(response.status, 400);
  assert.match(response.body, /That colour already exists for this material/);
  assert.equal(
    db
      .prepare('SELECT COUNT(*) AS count FROM stock_lots WHERE user_id = ? AND material = ? AND colour_name = ?')
      .get(userIdFor('cenius@cenius.ai'), 'smalti', 'Cobalt 031').count,
    1,
  );
});

test('one studio never sees another studio’s commission or glass', async () => {
  const client = new Client();
  await signIn(client, 'demo@mosaic.studio', 'mosaic123');

  const own = await client.get(`/commissions/${commissionIdFor('Café Sign Panel')}`);
  assert.equal(own.status, 200);

  const forbidden = await client.get(`/commissions/${commissionIdFor('Harbour Light Mosaic')}`);
  assert.equal(forbidden.status, 404);

  const list = await client.get('/commissions');
  assert.doesNotMatch(list.body, /Harbour Light Mosaic/);
  assert.match(list.body, /Café Sign Panel/);
});

test('signing up creates a studio with an empty dashboard', async () => {
  const client = new Client();
  const created = await client.post('/signup', {
    studio_name: 'Bench Test Studio',
    email: 'bench-test@example.com',
    username: 'benchtester',
    password: 'kiln-dust-99',
    confirm_password: 'kiln-dust-99',
  });
  assert.equal(created.status, 302);
  assert.match(created.location, /\/dashboard$/);

  const dashboard = await client.get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.body, /No commissions yet/);
  assert.match(dashboard.body, /Create your first commission/);

  const stored = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('bench-test@example.com');
  assert.match(stored.password_hash, /^\$2[aby]\$/);
});

test('sign-up validation rejects mismatched passwords and duplicate emails', async () => {
  const client = new Client();
  const mismatch = await client.post('/signup', {
    studio_name: 'Mismatch Studio',
    email: 'mismatch@example.com',
    username: 'mismatcher',
    password: 'one-two-three',
    confirm_password: 'three-two-one',
  });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.body, /Passwords do not match/);

  const duplicate = await client.post('/signup', {
    studio_name: 'Duplicate Studio',
    email: 'cenius@cenius.ai',
    username: 'someone-else',
    password: '***REDACTED-SECRET***',
    confirm_password: 'another-password',
  });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body, /That email is already registered/);
});

test('an unknown URL renders the styled 404 page inside the app shell', async () => {
  const client = new Client();
  const response = await client.get('/nope');
  assert.equal(response.status, 404);
  assert.match(response.body, /That bench is empty/);
  assert.match(response.body, /href="\/dashboard"|href="\/login"/);
});

test('signing out destroys the session', async () => {
  const client = new Client();
  await signIn(client, 'cenius@cenius.ai', 'cenius');
  const signedOut = await client.post('/logout');
  assert.equal(signedOut.status, 302);
  assert.match(signedOut.location, /\/login$/);

  const dashboard = await client.get('/dashboard');
  assert.equal(dashboard.status, 302);
  assert.match(dashboard.location, /\/login$/);
});
