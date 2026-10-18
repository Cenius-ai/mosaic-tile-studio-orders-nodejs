'use strict';

/**
 * End-to-end smoke test against a running server.
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 *
 * SIGNS IN as the demo studio, creates a commission, adds a colour line, reserves
 * the sheets it needs from the glass room and advances a workshop stage — then
 * removes the commission it created so the demo data stays tidy.
 */

const BASE_URL = (process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, '');
const DEMO_EMAIL = process.env.SMOKE_EMAIL || 'cenius@cenius.ai';
const DEMO_PASSWORD = process.env.SMOKE_PASSWORD || 'cenius';

const cookies = new Map();

function cookieHeader() {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function storeCookies(response) {
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
    if (!value) cookies.delete(name);
    else cookies.set(name, value);
  }
}

async function request(method, pathname, fields) {
  const init = { method, redirect: 'manual', headers: { cookie: cookieHeader() } };
  if (fields) {
    init.headers['content-type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(fields).toString();
  }
  const response = await fetch(BASE_URL + pathname, init);
  storeCookies(response);
  const body = await response.text();
  return { status: response.status, location: response.headers.get('location') || '', body };
}

/** Locate a glass lot's id from the stock table, so the smoke run can undo its own reservation. */
async function findLotId(colourName) {
  const page = await request('GET', '/stock');
  const row = page.body
    .split('<tr')
    .find((chunk) => chunk.includes(colourName) && chunk.includes('/adjust'));
  if (!row) return null;
  const match = row.match(/action="\/stock\/(\d+)\/adjust"/);
  return match ? match[1] : null;
}

function step(message) {
  console.log(`  ✓ ${message}`);
}

function fail(message) {
  console.error(`  ✗ ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  console.log(`Mosaic Tile Studio Orders — smoke test against ${BASE_URL}`);

  const health = await request('GET', '/health');
  if (health.status !== 200) fail(`/health returned ${health.status} — is the dev server running?`);
  step('server is answering on /health');

  const login = await request('POST', '/login', { identifier: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (login.status !== 302 || !login.location.endsWith('/dashboard')) {
    fail(`sign-in failed (status ${login.status}, location ${login.location})`);
  }
  step(`signed in as ${DEMO_EMAIL}`);

  const dashboard = await request('GET', '/dashboard');
  if (dashboard.status !== 200) fail(`/dashboard returned ${dashboard.status}`);
  step('dashboard renders the studio');

  const title = `Smoke trial ${new Date().toISOString().slice(11, 19)}`;
  const created = await request('POST', '/commissions', {
    title,
    client_name: 'Smoke Test Client',
    width_cm: '40',
    height_cm: '30',
    status: 'quoted',
    due_date: '',
    notes: 'Created by `npm run smoke`; removed again at the end of the run.',
  });
  if (created.status !== 302) fail(`creating a commission returned ${created.status}`);
  const commissionPath = created.location.replace(BASE_URL, '');
  const commissionId = commissionPath.split('/').pop();
  step(`created commission #${commissionId} “${title}”`);

  const withColour = await request('POST', `/commissions/${commissionId}/colors`, {
    colour_name: 'Cobalt 031',
    hex: '#2f4a8c',
    material: 'smalti',
    tessera_mm: '6',
    tesserae_count: '450',
  });
  if (withColour.status !== 302) fail(`adding a colour line returned ${withColour.status}`);
  const detail = await request('GET', `/commissions/${commissionId}`);
  if (!/2 sheets/.test(detail.body)) fail('the palette line does not show 2 sheets for 450 smalti tesserae');
  step('added a palette line: 450 smalti tesserae → 2 sheets');

  const reserved = await request('POST', `/commissions/${commissionId}/allocate`);
  if (reserved.status !== 302) fail(`reserving sheets returned ${reserved.status}`);
  const afterReserve = await request('GET', `/commissions/${commissionId}`);
  if (!/All sheets reserved/.test(afterReserve.body)) fail('the reserve button is not disabled after reserving');
  if (!/Reserved 2/.test(afterReserve.body)) fail('the colour line is not marked Reserved 2');
  step('reserved 2 sheets from the glass room (line shows Reserved 2)');

  const stageMatch = afterReserve.body.match(/\/commissions\/\d+\/stages\/(\d+)\/advance/);
  if (!stageMatch) fail('no active stage advance control found on the commission');
  const advanced = await request('POST', `/commissions/${commissionId}/stages/${stageMatch[1]}/advance`);
  if (advanced.status !== 302) fail(`advancing a stage returned ${advanced.status}`);
  const afterAdvance = await request('GET', `/commissions/${commissionId}`);
  if (!/Tesserae cutting/.test(afterAdvance.body)) fail('the next stage did not render after advancing');
  step('advanced the first workshop stage');

  const removed = await request('POST', `/commissions/${commissionId}/delete`, {});
  if (removed.status !== 302) fail(`deleting the smoke commission returned ${removed.status}`);
  step('removed the smoke commission again');

  // Put the two sheets back so repeated smoke runs leave the glass room untouched.
  const lotId = await findLotId('Cobalt 031');
  if (lotId) {
    const restored = await request('POST', `/stock/${lotId}/adjust`, { delta: '2' });
    if (restored.status === 302) step('returned 2 sheets of Cobalt 031 to the glass room');
  }

  await request('POST', '/logout');
  step('signed out');

  console.log('Smoke test passed.');
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
