'use strict';

const express = require('express');

const { db, nowIso } = require('../db');
const { hashPassword, verifyPassword } = require('../lib/password');
const { validateLogin, validateSignup, hasErrors } = require('../lib/validate');

const router = express.Router();

function findUserByIdentifier(identifier) {
  const value = String(identifier || '').trim().toLowerCase();
  if (!value) return null;
  return db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(value, value);
}

function sessionUser(user) {
  return { id: user.id, email: user.email, username: user.username, studio_name: user.studio_name };
}

/** Only ever redirect to a path inside this app. */
function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  if (value.startsWith('/login') || value.startsWith('/signup') || value === '/') return '/dashboard';
  return value;
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  return res.render('auth/login', {
    pageTitle: 'Sign in',
    values: { identifier: '' },
    errors: {},
    formError: null,
  });
});

router.post('/login', (req, res, next) => {
  const { values, errors } = validateLogin(req.body);
  if (hasErrors(errors)) {
    return res.status(400).render('auth/login', {
      pageTitle: 'Sign in',
      values,
      errors,
      formError: null,
    });
  }

  const user = findUserByIdentifier(values.identifier);
  if (!user || !verifyPassword(values.password, user.password_hash)) {
    // One non-enumerating message: it never says whether the email exists.
    return res.status(401).render('auth/login', {
      pageTitle: 'Sign in',
      values: { identifier: values.identifier },
      errors: {},
      formError: 'Email or password is incorrect',
    });
  }

  const target = safeReturnTo(req.session.returnTo);
  req.session.regenerate((regenerateError) => {
    if (regenerateError) return next(regenerateError);
    req.session.user = sessionUser(user);
    return req.session.save((saveError) => {
      if (saveError) return next(saveError);
      return res.redirect(target);
    });
  });
});

router.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  return res.render('auth/signup', {
    pageTitle: 'Create a studio account',
    values: { studio_name: '', email: '', username: '' },
    errors: {},
  });
});

router.post('/signup', (req, res, next) => {
  const { values, errors } = validateSignup(req.body);

  if (!errors.email) {
    const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(values.email);
    if (taken) errors.email = 'That email is already registered';
  }
  if (!errors.username) {
    const taken = db.prepare('SELECT id FROM users WHERE username = ?').get(values.username);
    if (taken) errors.username = 'That username is taken';
  }

  if (hasErrors(errors)) {
    return res.status(400).render('auth/signup', {
      pageTitle: 'Create a studio account',
      values: { studio_name: values.studio_name, email: values.email, username: values.username },
      errors,
    });
  }

  const now = nowIso();
  const info = db
    .prepare('INSERT INTO users (email, username, password_hash, studio_name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(values.email, values.username, hashPassword(values.password), values.studio_name, now);

  const user = {
    id: Number(info.lastInsertRowid),
    email: values.email,
    username: values.username,
    studio_name: values.studio_name,
  };

  req.session.regenerate((regenerateError) => {
    if (regenerateError) return next(regenerateError);
    req.session.user = sessionUser(user);
    req.flash('success', `${user.studio_name} is ready — add your first commission.`);
    return req.session.save((saveError) => {
      if (saveError) return next(saveError);
      return res.redirect('/dashboard');
    });
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('mosaic.sid');
    return res.redirect('/login');
  });
});

module.exports = router;
