-- Mosaic Tile Studio Orders — schema.
-- Applied on every boot (idempotent) and by `npm run seed`.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  studio_name   TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  width_cm    REAL,
  height_cm   REAL,
  status      TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'in_progress', 'completed')),
  due_date    TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_commissions_user ON commissions(user_id);
CREATE INDEX IF NOT EXISTS ix_commissions_user_status ON commissions(user_id, status);

CREATE TABLE IF NOT EXISTS tesserae_lines (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  commission_id   INTEGER NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  colour_name     TEXT NOT NULL,
  hex             TEXT NOT NULL,
  material        TEXT NOT NULL CHECK (material IN ('smalti', 'vitreous')),
  tessera_mm      REAL,
  tesserae_count  INTEGER NOT NULL CHECK (tesserae_count > 0),
  sheets_reserved INTEGER NOT NULL DEFAULT 0 CHECK (sheets_reserved >= 0),
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_lines_commission ON tesserae_lines(commission_id);

CREATE TABLE IF NOT EXISTS stock_lots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material            TEXT NOT NULL CHECK (material IN ('smalti', 'vitreous')),
  colour_name         TEXT NOT NULL,
  hex                 TEXT NOT NULL,
  sheets_on_hand      INTEGER NOT NULL CHECK (sheets_on_hand >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
  updated_at          TEXT NOT NULL,
  UNIQUE (user_id, material, colour_name)
);
CREATE INDEX IF NOT EXISTS ix_stock_user ON stock_lots(user_id);

CREATE TABLE IF NOT EXISTS stage_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commission_id INTEGER NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  stage_key     TEXT NOT NULL,
  label         TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'active', 'done')),
  note          TEXT NOT NULL DEFAULT '',
  started_at    TEXT,
  completed_at  TEXT,
  sort_order    INTEGER NOT NULL,
  UNIQUE (commission_id, stage_key)
);
CREATE INDEX IF NOT EXISTS ix_stages_commission ON stage_events(commission_id);
