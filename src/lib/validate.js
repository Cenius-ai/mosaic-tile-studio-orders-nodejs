'use strict';

const { MATERIALS } = require('./tesserae');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['quoted', 'in_progress', 'completed'];

function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function parseNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const numeric = Number(String(value).trim());
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

function validateCommission(body = {}) {
  const values = {
    title: text(body.title, 120),
    client_name: text(body.client_name, 120),
    width_cm: text(body.width_cm, 12),
    height_cm: text(body.height_cm, 12),
    status: text(body.status, 20) || 'quoted',
    due_date: text(body.due_date, 10),
    notes: text(body.notes, 2000),
  };
  const errors = {};

  if (!values.title) errors.title = 'Title is required';

  for (const [field, label] of [
    ['width_cm', 'Width'],
    ['height_cm', 'Height'],
  ]) {
    const numeric = parseNumber(values[field]);
    if (numeric === null) continue;
    if (Number.isNaN(numeric) || numeric <= 0) {
      errors[field] = `${label} must be a positive number of centimetres`;
    } else if (numeric > 5000) {
      errors[field] = `${label} must be 5000 cm or less`;
    }
  }

  if (!STATUSES.includes(values.status)) errors.status = 'Choose a status';
  if (values.due_date && !DATE_PATTERN.test(values.due_date)) errors.due_date = 'Use a date such as 2025-04-18';

  return { values, errors };
}

function validateColourLine(body = {}) {
  const values = {
    colour_name: text(body.colour_name, 60),
    hex: text(body.hex, 7) || '#bd9121',
    material: text(body.material, 20),
    tessera_mm: text(body.tessera_mm, 8),
    tesserae_count: text(body.tesserae_count, 12),
  };
  const errors = {};

  if (!values.colour_name) errors.colour_name = 'Colour name is required';
  if (!HEX_PATTERN.test(values.hex)) errors.hex = 'Pick a colour swatch';
  if (!MATERIALS.includes(values.material)) errors.material = 'Choose smalti or vitreous glass';

  const mm = parseNumber(values.tessera_mm);
  if (mm !== null && (Number.isNaN(mm) || mm <= 0 || mm > 100)) {
    errors.tessera_mm = 'Tessera size must be between 0 and 100 mm';
  }

  const count = parseNumber(values.tesserae_count);
  if (count === null) {
    errors.tesserae_count = 'Tesserae count is required';
  } else if (Number.isNaN(count) || !Number.isInteger(count) || count <= 0) {
    errors.tesserae_count = 'Tesserae count must be a whole number above zero';
  } else if (count > 1000000) {
    errors.tesserae_count = 'Tesserae count must be 1,000,000 or less';
  }

  return { values, errors };
}

function validateStockLot(body = {}) {
  const values = {
    material: text(body.material, 20),
    colour_name: text(body.colour_name, 60),
    hex: text(body.hex, 7) || '#bd9121',
    sheets_on_hand: text(body.sheets_on_hand, 12),
    low_stock_threshold: text(body.low_stock_threshold, 6),
  };
  const errors = {};

  if (!MATERIALS.includes(values.material)) errors.material = 'Choose smalti or vitreous glass';
  if (!values.colour_name) errors.colour_name = 'Colour name is required';
  if (!HEX_PATTERN.test(values.hex)) errors.hex = 'Pick a colour swatch';

  const sheets = parseNumber(values.sheets_on_hand);
  if (sheets === null) {
    errors.sheets_on_hand = 'Sheets on hand is required';
  } else if (Number.isNaN(sheets) || !Number.isInteger(sheets) || sheets < 0 || sheets > 100000) {
    errors.sheets_on_hand = 'Sheets on hand must be a whole number between 0 and 100,000';
  }

  const threshold = parseNumber(values.low_stock_threshold);
  if (threshold === null) {
    values.low_stock_threshold = '2';
  } else if (Number.isNaN(threshold) || !Number.isInteger(threshold) || threshold < 0 || threshold > 1000) {
    errors.low_stock_threshold = 'Low-stock threshold must be a whole number between 0 and 1,000';
  }

  return { values, errors };
}

function validateSignup(body = {}) {
  const values = {
    studio_name: text(body.studio_name, 80),
    email: text(body.email, 160).toLowerCase(),
    username: text(body.username, 24).toLowerCase(),
    password: typeof body.password === 'string' ? body.password : '',
    confirm_password: typeof body.confirm_password === 'string' ? body.confirm_password : '',
  };
  const errors = {};

  if (!values.studio_name) errors.studio_name = 'Studio name is required';
  if (!values.email) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Enter an email address such as studio@example.com';
  }
  if (!values.username) {
    errors.username = 'Username is required';
  } else if (!USERNAME_PATTERN.test(values.username)) {
    errors.username = 'Use 3–24 lowercase letters, numbers, hyphens or underscores';
  }
  if (!values.password) {
    errors.password = 'Password is required';
  } else if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters';
  } else if (values.password.length > 72) {
    errors.password = 'Use 72 characters or fewer';
  }
  if (values.password !== values.confirm_password) errors.confirm_password = 'Passwords do not match';

  return { values, errors };
}

function validateLogin(body = {}) {
  const values = {
    identifier: text(body.identifier ?? body.email ?? body.username, 160),
    password: typeof body.password === 'string' ? body.password : '',
  };
  const errors = {};
  if (!values.identifier) errors.identifier = 'Enter your email or username';
  if (!values.password) errors.password = 'Enter your password';
  return { values, errors };
}

module.exports = {
  EMAIL_PATTERN,
  USERNAME_PATTERN,
  HEX_PATTERN,
  STATUSES,
  hasErrors,
  text,
  parseNumber,
  validateCommission,
  validateColourLine,
  validateStockLot,
  validateSignup,
  validateLogin,
};
