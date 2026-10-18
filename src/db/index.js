'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..', '..');
const configuredPath = process.env.STUDIO_DB || path.join('data', 'studio.db');
const dbFile = path.resolve(projectRoot, configuredPath);

// SQLite never creates missing directories for us — a fresh clone has no ./data.
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Apply schema.sql. Every statement is CREATE ... IF NOT EXISTS, so this is safe on each boot. */
function migrate() {
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { db, dbFile, migrate, nowIso };
