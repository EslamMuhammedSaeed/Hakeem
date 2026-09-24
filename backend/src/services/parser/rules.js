import { parseNumber } from './normalize.js';

/**
 * Every pattern below runs against text that has already been through `foldArabic`,
 * so Arabic keywords are written in their folded spelling: ة -> ه, أ/إ/آ -> ا, ى -> ي.
 * That is why you see "كميه" and "امر" rather than "كمية" and "أمر".
 */

const NUM = String.raw`\d+(?:\.\d+)?`;

const BUY_WORDS = /(?:شراء|اشتري|شرا\b|تملك|buy|bought|purchase)/i;
const SELL_WORDS = /(?:بيع|بعت|sell|sold)/i;

// Latin tokens that look like tickers but never are
const TICKER_BLOCKLIST = new Set([
  'EGP', 'USD', 'EUR', 'BUY', 'SELL', 'THNDR', 'EGX', 'PM', 'AM', 'API', 'OK',
  'NEW', 'YOUR', 'ORDER', 'SHARE', 'SHARES', 'AT', 'FOR', 'THE', 'AND', 'WAS',
]);

export function extractSide(text) {
  const buy = text.search(BUY_WORDS);
  const sell = text.search(SELL_WORDS);
  if (buy === -1 && sell === -1) return null;
  if (buy === -1) return 'SELL';
  if (sell === -1) return 'BUY';
  // Both words present (e.g. a generic "buy/sell" footer) - the earlier one wins
  return buy < sell ? 'BUY' : 'SELL';
}

export function extractQuantity(text) {
  const patterns = [
    new RegExp(String.raw`(?:كميه|بكميه|عدد|الكميه)\s*[:=]?\s*(${NUM})`, 'i'),
    new RegExp(String.raw`(${NUM})\s*(?:سهم|اسهم|سهما|ورقه)`, 'i'),
    new RegExp(String.raw`(?:quantity|qty|shares?)\s*[:=]?\s*(${NUM})`, 'i'),
    new RegExp(String.raw`(${NUM})\s*shares?\b`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseNumber(match[1]);
      if (value !== null && value > 0) return value;
    }
  }
  return null;
}

export function extractPrice(text) {
  const patterns = [
    new RegExp(String.raw`(?:بسعر|بمتوسط سعر|متوسط سعر|السعر|سعر|بقيمه سهم)\s*[:=]?\s*(${NUM})`, 'i'),
    new RegExp(String.raw`(?:at price|price|@)\s*[:=]?\s*(${NUM})`, 'i'),
    new RegExp(String.raw`(${NUM})\s*(?:جنيه|ج\.م|egp)(?![a-z])`, 'i'),
    // "executed at 42.10" - the lookaheads keep clock times and share counts out
    new RegExp(String.raw`\bat\s+(${NUM})(?!\s*[:.]\d)(?!\s*(?:shares?|سهم))`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseNumber(match[1]);
      if (value !== null && value > 0) return value;
    }
  }
  return null;
}

export function extractFees(text) {
  const match = text.match(new RegExp(String.raw`(?:عموله|عمولات|رسوم|مصاريف|ضريبه|fees?|commission)\s*[:=]?\s*(${NUM})`, 'i'));
  const value = match ? parseNumber(match[1]) : null;
  return value !== null && value >= 0 ? value : null;
}

export function extractTotal(text) {
  const match = text.match(
    new RegExp(String.raw`(?:اجمالي|الاجمالي|بقيمه اجماليه|المبلغ|صافي|total|net amount)\s*[:=]?\s*(${NUM})`, 'i'),
  );
  const value = match ? parseNumber(match[1]) : null;
  return value !== null && value > 0 ? value : null;
}

function cleanArabicName(value) {
  return value
    .replace(/^(?:من|في|ل|لسهم|سهم|اسهم|شركه|بشركه)\s+/i, '')
    .replace(/\s+(?:بسعر|سعر|كميه|عدد|بقيمه|اجمالي)$/i, '')
    .trim();
}

export function extractSymbol(text) {
  // 1. An explicit ticker, optionally with the EGX .CA suffix
  const tickerMatches = text.match(/\b[A-Z]{2,6}(?:\.CA)?\b/g) ?? [];
  for (const candidate of tickerMatches) {
    const base = candidate.replace(/\.CA$/i, '');
    if (!TICKER_BLOCKLIST.has(base.toUpperCase())) return candidate.toUpperCase();
  }

  // 2. A company name following a marker word, stopping before the next field keyword
  const namePatterns = [
    /(?:سهم|اسهم|شركه|من شركه)\s+([\u0621-\u064A][\u0621-\u064A\s\-&.]{1,40}?)(?=\s*(?:بسعر|سعر|كميه|عدد|بقيمه|اجمالي|\d|$))/,
    /(?:من|في)\s+([\u0621-\u064A][\u0621-\u064A\s\-&.]{2,40}?)(?=\s*(?:بسعر|سعر|كميه|عدد|بقيمه|اجمالي|\d|$))/,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = cleanArabicName(match[1]);
      if (name.length >= 2) return name;
    }
  }

  return null;
}

function buildFromFields(text, forcedSide) {
  const side = forcedSide ?? extractSide(text);
  const quantity = extractQuantity(text);
  const price = extractPrice(text);
  if (!side || quantity === null || price === null) return null;
  return {
    side,
    symbol: extractSymbol(text),
    quantity,
    price,
    fees: extractFees(text) ?? 0,
    total: extractTotal(text),
  };
}

/**
 * Ordered most-specific first. The first rule whose pattern matches and whose
 * `extract` returns a complete result wins, and its id is stored on the notification
 * so you can always tell which rule produced a trade.
 */
export const rules = [
  {
    id: 'ar-executed-qty-symbol-price',
    description: 'تم تنفيذ أمر شراء 100 سهم من COMI بسعر 85.50',
    // No \b anywhere: JavaScript word boundaries are ASCII-only and never match
    // between two Arabic letters, which would stop this pattern from ever firing.
    pattern: new RegExp(
      String.raw`(?:تم\s+)?(?:تنفيذ|نفذ)[^\d]{0,40}?(?<side>شراء|بيع)[^\d]{0,40}?(?<qty>${NUM})\s*(?:سهم|اسهم|سهما)`,
      'i',
    ),
    extract: (match, text) => {
      const side = BUY_WORDS.test(match.groups.side) ? 'BUY' : 'SELL';
      const quantity = parseNumber(match.groups.qty);
      const price = extractPrice(text);
      if (!quantity || price === null) return null;
      return {
        side,
        symbol: extractSymbol(text),
        quantity,
        price,
        fees: extractFees(text) ?? 0,
        total: extractTotal(text),
      };
    },
  },
  {
    id: 'ar-executed-symbol-then-qty',
    description: 'تم تنفيذ عملية بيع على سهم HRHO كمية 500 بسعر 18.2',
    pattern: new RegExp(String.raw`(?:تم\s+)?(?:تنفيذ|نفذ|اكتمل).{0,60}?(?:شراء|بيع)`, 'i'),
    extract: (_match, text) => buildFromFields(text),
  },
  {
    id: 'en-order-executed',
    description: 'Your buy order for 100 shares of COMI was executed at 85.5',
    pattern: /\b(?:executed|filled|order (?:was )?(?:executed|filled))\b/i,
    extract: (_match, text) => buildFromFields(text),
  },
  {
    id: 'generic-side-qty-price',
    description: 'Fallback: any text carrying a side keyword plus a quantity and a price',
    pattern: /(?:شراء|بيع|buy|sell|bought|sold)/i,
    extract: (_match, text) => buildFromFields(text),
  },
];
