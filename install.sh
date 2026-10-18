#!/usr/bin/env bash
# Mosaic Tile Studio Orders — project-level setup.
# Installs dependencies, writes a local .env with a generated session secret and
# seeds the demo studios. It never starts the server and never touches system packages.
set -eu
cd "$(dirname "$0")"

echo "[install] Mosaic Tile Studio Orders"

if ! command -v node >/dev/null 2>&1; then
  echo "[install] Node.js is required (18 or newer). See INSTALL.md." >&2
  exit 1
fi

node scripts/ensure-env.js

echo "[install] installing npm dependencies"
# node version advisory (auto-added by cenius)
if command -v node >/dev/null 2>&1; then
  _REQ_NODE="$(node -p "(require('./package.json').engines||{}).node||''" 2>/dev/null || true)"
  [ -n "$_REQ_NODE" ] && echo "-> This app requires Node $_REQ_NODE (you have $(node -v)). If install fails with EBADENGINE, upgrade Node: https://nodejs.org"
fi
npm install --no-audit --no-fund

echo "[install] creating the SQLite schema and seeding the demo studios"
node src/db/seed.js

echo "[install] done."
echo "[install] start the studio with: npm run dev   (http://localhost:3000)"
