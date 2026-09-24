import Decimal from 'decimal.js';
import { foldArabic, normalize } from './normalize.js';
import { rules } from './rules.js';

/**
 * Notifications that are definitely not trades. Matching one marks the row IGNORED
 * instead of FAILED so the inbox only surfaces text that genuinely needs a new rule.
 */
const IGNORE_PATTERNS = [
  /(?:مرحبا|اهلا|welcome)/i,
  /(?:فتح|اغلاق|يفتح|يغلق|سيفتح|سيغلق) السوق/i,
  /السوق (?:يفتح|يغلق|سيفتح|سيغلق)/i,
  /(?:market (?:open|close|opens|closes))/i,
  /(?:عرض|خصم|كود|promo|discount|referral)/i,
  /(?:كود التحقق|رمز التحقق|verification code|otp)/i,
  /(?:تم ايداع|تم سحب|deposit|withdraw)/i,
];

/**
 * Words that make a notification worth investigating even when no side keyword was
 * found. Text with neither a side nor one of these is ordinary app chatter, so it is
 * marked IGNORED rather than cluttering the inbox as a parse failure.
 */
const TRADE_HINTS = /(?:تنفيذ|نفذ|امر|اوردر|صفقه|عمليه|order|executed|filled|trade)/i;
const SIDE_HINTS = /(?:شراء|بيع|اشتري|بعت|buy|sell|bought|sold)/i;

const MAX_FEE_RATIO = 0.05;

function deriveFees(gross, total, extractedFees) {
  if (extractedFees > 0) return new Decimal(extractedFees);
  if (total === null) return new Decimal(0);
  const diff = new Decimal(total).minus(gross).abs();
  // A stated total that differs slightly from qty * price is almost always commission
  return diff.gt(0) && diff.div(gross).lte(MAX_FEE_RATIO) ? diff : new Decimal(0);
}

/**
 * Runs the rule table over a notification. Never throws: an unparseable notification
 * is a normal outcome that gets reported back so the raw text can be kept and retried.
 *
 * @returns {{status: 'PARSED'|'IGNORED'|'FAILED', ruleId: string|null, error: string|null, trade: object|null}}
 */
export function parseNotification({ title = '', body = '', executedAt = new Date() } = {}) {
  const combined = [title, body].filter(Boolean).join(' \u2014 ');
  const text = foldArabic(combined);

  if (!text) {
    return { status: 'FAILED', ruleId: null, error: 'Notification carried no text', trade: null };
  }

  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(text)) {
      return { status: 'IGNORED', ruleId: null, error: null, trade: null };
    }
  }

  if (!SIDE_HINTS.test(text) && !TRADE_HINTS.test(text)) {
    return { status: 'IGNORED', ruleId: null, error: null, trade: null };
  }

  const attempted = [];

  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    attempted.push(rule.id);

    let fields = null;
    try {
      fields = rule.extract(match, text);
    } catch (error) {
      attempted.push(`${rule.id}:error(${error.message})`);
      continue;
    }
    if (!fields) continue;

    const quantity = new Decimal(fields.quantity);
    const price = new Decimal(fields.price);
    const gross = quantity.times(price);
    const fees = deriveFees(gross, fields.total ?? null, fields.fees ?? 0);
    const netAmount = fields.side === 'BUY' ? gross.plus(fees) : gross.minus(fees);

    return {
      status: 'PARSED',
      ruleId: rule.id,
      error: null,
      trade: {
        side: fields.side,
        symbol: (fields.symbol ?? 'UNKNOWN').slice(0, 32),
        quantity: quantity.toFixed(4),
        price: price.toFixed(6),
        fees: fees.toFixed(6),
        netAmount: netAmount.toFixed(6),
        gross: gross.toFixed(6),
        executedAt,
      },
    };
  }

  const reason = attempted.length
    ? `Rules matched but could not extract side, quantity and price (tried: ${attempted.join(', ')})`
    : 'No parsing rule matched this text';

  return { status: 'FAILED', ruleId: null, error: reason, trade: null };
}

/**
 * Non-persisting variant used by the parser playground in the dashboard.
 */
export function previewParse({ title = '', body = '' } = {}) {
  const combined = [title, body].filter(Boolean).join(' \u2014 ');
  const result = parseNotification({ title, body });
  return {
    ...result,
    normalized: normalize(combined),
    folded: foldArabic(combined),
  };
}
