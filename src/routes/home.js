'use strict';

const express = require('express');

const router = express.Router();

// Public front door: a real screen for anyone not signed in, the dashboard for a studio.
router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  return res.render('home', { pageTitle: 'Commissions, tesserae counts and the glass room' });
});

module.exports = router;
