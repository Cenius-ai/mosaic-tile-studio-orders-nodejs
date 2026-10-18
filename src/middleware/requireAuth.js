'use strict';

/** Only signed-in studios reach the app; everyone else goes to the sign-in card. */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

module.exports = requireAuth;
