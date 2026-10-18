'use strict';

const bcrypt = require('bcryptjs');

// One cost factor, used by the seed, by sign-up and by sign-in verification.
const BCRYPT_COST = 12;

function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('hashPassword requires a non-empty string');
  }
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

function verifyPassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string' || !hash) return false;
  return bcrypt.compareSync(plain, hash);
}

module.exports = { hashPassword, verifyPassword, BCRYPT_COST };
