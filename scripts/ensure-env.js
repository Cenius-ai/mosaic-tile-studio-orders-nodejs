'use strict';

/**
 * install.sh helper: make sure a local .env exists and carries a real session secret.
 * Idempotent — an existing secret is never overwritten.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('[env] created .env from .env.example');
  } else {
    fs.writeFileSync(envPath, '');
    console.log('[env] created an empty .env');
  }
}

let text = fs.readFileSync(envPath, 'utf8');
const hasSecret = /^SESSION_SECRET=.{16,}$/m.test(text);

if (!hasSecret) {
  const secret = crypto.randomBytes(32).toString('hex');
  if (/^SESSION_SECRET=/m.test(text)) {
    text = text.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);
  } else {
    const separator = text.length > 0 && !text.endsWith('\n') ? '\n' : '';
    text += `${separator}SESSION_SECRET=${secret}\n`;
  }
  fs.writeFileSync(envPath, text, { mode: 0o600 });
  console.log('[env] generated a 64-character SESSION_SECRET in .env');
} else {
  console.log('[env] keeping the existing SESSION_SECRET');
}
