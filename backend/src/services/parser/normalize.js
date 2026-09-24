const ARABIC_INDIC = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const EXTENDED_ARABIC_INDIC = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';

const BIDI_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const TATWEEL = /\u0640/g;
const DIACRITICS = /[\u064B-\u0652\u0653-\u0655\u0670]/g;

function toAsciiDigits(text) {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (char) => {
    const arabicIndex = ARABIC_INDIC.indexOf(char);
    if (arabicIndex >= 0) return String(arabicIndex);
    return String(EXTENDED_ARABIC_INDIC.indexOf(char));
  });
}

/**
 * Turns a notification string into a stable shape the rule patterns can match against.
 * Android notifications arrive with bidi control characters, Arabic-Indic digits and
 * inconsistent letter forms, none of which a plain regex survives.
 */
export function normalize(input) {
  if (typeof input !== 'string') return '';

  let text = input.normalize('NFKC');
  text = text.replace(BIDI_MARKS, '');
  text = toAsciiDigits(text);
  text = text.replace(TATWEEL, '').replace(DIACRITICS, '');

  // Arabic decimal separator and thousands separator
  text = text.replace(/\u066B/g, '.').replace(/\u066C/g, ',');

  // Arabic punctuation to ASCII equivalents
  text = text.replace(/\u060C/g, ',').replace(/\u061B/g, ';').replace(/\u061F/g, '?');

  // Thousands separators inside numbers get in the way of numeric capture
  text = text.replace(/(\d),(?=\d{3}\b)/g, '$1');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Letter-level folding used for keyword lookups. Makes "أمر"/"امر" and "شركة"/"شركه"
 * comparable so rule patterns only need one spelling. Latin case is preserved because
 * ticker detection depends on it; rules use the `i` flag where case is irrelevant.
 */
export function foldArabic(text) {
  return normalize(text)
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A');
}

export function parseNumber(value) {
  if (value === undefined || value === null) return null;
  const cleaned = normalize(String(value)).replace(/[^\d.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}
