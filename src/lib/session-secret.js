'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The session signing secret.
 *
 * - `SESSION_SECRET` from the environment (install.sh generates one into .env) wins.
 * - Otherwise a secret is generated once and stored beside the database, so a bare
 *   `npm start` on a fresh clone works and sessions survive restarts.
 * - Nothing secret is ever committed to the repository.
 */
function loadSessionSecret(dataDirectory) {
  const fromEnv = (process.env.SESSION_SECRET || '').trim();
  if (fromEnv.length >= 16) return fromEnv;

  const secretFile = path.join(dataDirectory, '.session-secret');
  try {
    const stored = fs.readFileSync(secretFile, 'utf8').trim();
    if (stored.length >= 32) return stored;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  return generated;
}

module.exports = { loadSessionSecret };
