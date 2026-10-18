'use strict';

/**
 * One-shot flash messages kept in the session so redirect-after-post can confirm
 * what just happened. The banner disappears on the next navigation by design.
 */
function flash(req, res, next) {
  res.locals.flash = (req.session && req.session.flash) || null;
  if (req.session) delete req.session.flash;

  req.flash = (type, message) => {
    if (!req.session) return;
    req.session.flash = { type, message };
  };

  next();
}

module.exports = flash;
