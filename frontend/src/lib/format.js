import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Africa/Cairo';

const currencyFormatter = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export function money(value, { sign = false } = {}) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  const formatted = currencyFormatter.format(Math.abs(num));
  const prefix = num < 0 ? '-' : sign && num > 0 ? '+' : '';
  return `${prefix}${formatted}`;
}

export function quantity(value) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? quantityFormatter.format(num) : '-';
}

export function price(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num);
}

export function percent(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
}

export function dateTime(value) {
  if (!value) return '-';
  return formatInTimeZone(new Date(value), TIMEZONE, 'dd MMM yyyy HH:mm');
}

export function dateOnly(value) {
  if (!value) return '-';
  return formatInTimeZone(new Date(value), TIMEZONE, 'dd MMM yyyy');
}

export function toLocalInputValue(value) {
  const date = value ? new Date(value) : new Date();
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

export function pnlClass(value) {
  const num = Number(value ?? 0);
  if (num > 0) return 'text-emerald-400';
  if (num < 0) return 'text-rose-400';
  return 'text-slate-400';
}
