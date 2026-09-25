import i18n from '../i18n/index.js';

const TIMEZONE = 'Africa/Cairo';

const numberFormatters = new Map();
const dateFormatters = new Map();

function numberLocale() {
  return i18n.resolvedLanguage?.startsWith('en') ? 'en-EG' : 'ar-EG-u-nu-latn';
}

function numberFormatter(options) {
  const key = `${numberLocale()}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(numberLocale(), options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function dateFormatter(withTime) {
  const key = `${numberLocale()}|${withTime}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(numberLocale(), {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    });
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

export function money(value, { sign = false } = {}) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return numberFormatter({
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(num);
}

export function quantity(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return numberFormatter({ minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(num);
}

export function price(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return numberFormatter({ minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num);
}

export function percent(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  const formatted = numberFormatter({
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(num);
  return `${formatted}%`;
}

export function dateTime(value) {
  if (!value) return '-';
  return dateFormatter(true).format(new Date(value));
}

export function dateOnly(value) {
  if (!value) return '-';
  return dateFormatter(false).format(new Date(value));
}

export function toLocalInputValue(value) {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function pnlClass(value) {
  const num = Number(value ?? 0);
  if (num > 0) return 'text-emerald-400';
  if (num < 0) return 'text-rose-400';
  return 'text-slate-400';
}
