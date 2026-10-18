'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { dbFile } = require('./db');
const flash = require('./middleware/flash');
const format = require('./lib/format');
const { MATERIAL_LABELS } = require('./lib/tesserae');
const { loadSessionSecret } = require('./lib/session-secret');

const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const publicDir = path.join(__dirname, '..', 'public');

// Security headers. The CSP keeps every script in a same-origin file — there is no
// inline <script> anywhere — so `script-src 'self'` holds. Inline *styles* are allowed
// because palette swatches are painted from a validated `#rrggbb` value.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
      },
    },
    // The preview and local development run over plain HTTP; HSTS would be noise.
    hsts: false,
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.static(publicDir, { etag: true, maxAge: 0, index: false }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use(
  session({
    name: 'mosaic.sid',
    secret: loadSessionSecret(path.dirname(dbFile)),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Served over plain HTTP in development: a Secure cookie would be silently
      // dropped and every request after sign-in would hit the wall again.
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  }),
);

app.use(flash);

app.use((req, res, next) => {
  res.locals.currentUser = (req.session && req.session.user) || null;
  res.locals.currentPath = req.path;
  res.locals.fmt = format;
  res.locals.materialLabels = MATERIAL_LABELS;
  res.locals.pageTitle = 'Mosaic Tile Studio Orders';
  res.locals.bodyClass = '';
  next();
});

app.use('/', require('./routes/home'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/commissions'));
app.use('/', require('./routes/colors'));
app.use('/', require('./routes/allocate'));
app.use('/', require('./routes/stages'));
app.use('/', require('./routes/stock'));

app.get('/health', (req, res) => {
  res.type('text/plain').send('ok');
});

app.use((req, res) => {
  res.status(404).render('errors/404', { pageTitle: 'Page not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[mosaic] request failed:', err && err.stack ? err.stack : err);
  res.status(500).render('errors/500', { pageTitle: 'Something went wrong' });
});

module.exports = app;
