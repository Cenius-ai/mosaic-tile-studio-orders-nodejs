'use strict';

const numberFormatter = new Intl.NumberFormat('en-GB');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a stored 'YYYY-MM-DD' date as a local calendar day (never shift across time zones). */
function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(value) {
  const date = parseDateOnly(value) || parseTimestamp(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  const date = parseTimestamp(value) || parseDateOnly(value);
  if (!date) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysUntil(value) {
  const date = parseDateOnly(value);
  if (!date) return null;
  return Math.round((date.getTime() - startOfToday().getTime()) / DAY_MS);
}

/** "Due in 12 days" · "Due today" · "Overdue by 3 days" — never "-1 days ago". */
function dueLabel(value) {
  const days = daysUntil(value);
  if (days === null) return 'No due date';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Overdue by 1 day';
  return `Overdue by ${Math.abs(days)} days`;
}

function isOverdue(value) {
  const days = daysUntil(value);
  return days !== null && days < 0;
}

function number(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numberFormatter.format(numeric) : '—';
}

function decimal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numberFormatter.format(numeric);
}

function plural(count, singular, pluralForm) {
  return Number(count) === 1 ? singular : pluralForm || `${singular}s`;
}

function dimensions(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 'Dimensions not set';
  return `${decimal(w)} × ${decimal(h)} cm`;
}

const STATUS_LABELS = Object.freeze({
  quoted: 'Quoted',
  in_progress: 'In progress',
  completed: 'Completed',
});

const STATUS_TOKENS = Object.freeze({
  quoted: 'quoted',
  in_progress: 'progress',
  completed: 'done',
});

function statusLabel(status) {
  return STATUS_LABELS[status] || 'Unknown';
}

function statusToken(status) {
  return STATUS_TOKENS[status] || 'quoted';
}

module.exports = {
  formatDate,
  formatDateTime,
  dueLabel,
  daysUntil,
  isOverdue,
  number,
  decimal,
  plural,
  dimensions,
  statusLabel,
  statusToken,
  STATUS_LABELS,
};
