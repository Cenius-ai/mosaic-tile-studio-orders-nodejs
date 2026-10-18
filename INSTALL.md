# Installing Mosaic Tile Studio Orders

## Prerequisites

These are installed by you, not by `install.sh`:

- **Node.js 18 or newer** (developed and tested on Node 20) and **npm**.
- A C/C++ toolchain only if `better-sqlite3` has no prebuilt binary for your platform and Node version:
  `python3`, `make` and a C++ compiler (`g++` / Xcode Command Line Tools). On common Linux, macOS and Windows
  setups the prebuilt binary is used and nothing needs compiling.
- Nothing else. There is no database server, no cache, no external service and no network access at runtime.

Package manager: **npm** (the repository ships `package-lock.json`; do not mix in yarn or pnpm).

## 1. Install project dependencies, environment file and demo data

```bash
sh install.sh
```

That one command:

1. copies `.env.example` to `.env` if `.env` is missing, and generates a random `SESSION_SECRET` into it
   (an existing secret is never overwritten);
2. runs `npm install --no-audit --no-fund`;
3. creates the SQLite schema and seeds the two demo studios.

It exits when it is done — it never starts the server.

## 2. (Optional) Start from a clean, known demo state

```bash
npm run seed
```

Reseeds the demo studios idempotently (safe to re-run). The seed only touches the two demo accounts; a studio
account you sign up for keeps its own data.

## 3. Run the app in development

```bash
npm run dev
```

This starts `nodemon` on `0.0.0.0:${PORT:-3000}` and prints
`[mosaic] listening on http://0.0.0.0:3000`. Open <http://localhost:3000>.

## 4. Sign in

Demo accounts (also printed on the sign-in card):

| Email | Username | Password |
| --- | --- | --- |
| cenius@cenius.ai | cenius | cenius |
| demo@mosaic.studio | demo | mosaic123 |

## 5. Checks

```bash
npm test        # 22 tests, throwaway database, no network
npm run smoke   # drives the running server (start it first) and cleans up after itself
```

## Production-style start

```bash
npm start
```

Same server without nodemon. Set `PORT`, `STUDIO_DB` and `SESSION_SECRET` in the environment (see
`.env.example`). The SQLite file lives at `data/studio.db` relative to the project; the directory is created
automatically. Run behind an HTTPS terminator and set `NODE_ENV=production` if you add caching at the proxy —
the cookie stays `HttpOnly` + `SameSite=Lax` and is not marked `Secure` because the bundled server itself is
plain HTTP.

## Dependency notes

`package.json` carries an `overrides` entry pinning `chokidar` to v4 so nodemon does not pull in the flagged
`braces@3.0.3` transitive dependency. Run `npm install` (never `npm audit fix`) so the committed
`package-lock.json` is used as-is.

## Troubleshooting

- **`EADDRINUSE` on start** — something already holds the port. `PORT=3100 npm run dev`.
- **`Cannot find module 'better-sqlite3'`** — `npm install` did not run; run `sh install.sh` again.
- **Fresh clone boots to an empty studio** — the boot path seeds only when the database has no users. Run
  `npm run seed` to reset the demo studios.
- **Sessions drop after a restart** — set `SESSION_SECRET` in `.env` so the signing key is stable (install.sh
  does this for you); otherwise a secret is generated once in `data/.session-secret`.
