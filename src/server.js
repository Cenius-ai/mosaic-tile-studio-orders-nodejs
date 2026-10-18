'use strict';

// Environment first: STUDIO_DB and SESSION_SECRET must be known before the db module opens.
require('dotenv').config();

const app = require('./app');
const { db, dbFile, migrate } = require('./db');
const { seedIfEmpty } = require('./db/seed');

const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';

// Schema first, then demo data on a fresh database, then listen. All synchronous and
// quick, so the port is bound immediately instead of behind a slow init.
migrate();
const seedResult = seedIfEmpty(db);
if (seedResult.seeded) {
  console.log(
    `[mosaic] seeded demo studios — ${seedResult.commissions} commissions, ${seedResult.lots} glass lots.`,
  );
}

const server = app.listen(port, host, () => {
  console.log(`[mosaic] listening on http://${host}:${port} — database ${dbFile}`);
});

function shutdown(signal) {
  console.log(`[mosaic] ${signal} received, closing down.`);
  server.close(() => {
    try {
      db.close();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
