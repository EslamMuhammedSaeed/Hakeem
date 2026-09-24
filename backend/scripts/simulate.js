#!/usr/bin/env node
/**
 * Posts sample notifications at the webhook exactly like the phone would, so you can
 * exercise the whole pipeline without waiting for a real fill.
 *
 *   node scripts/simulate.js              # send the built-in Arabic samples
 *   node scripts/simulate.js "نص الاشعار" # send one custom text
 */
import 'dotenv/config';

const BASE_URL = process.env.SIMULATE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const API_KEY = process.env.WEBHOOK_API_KEY;

const SAMPLES = [
  { title: 'ثاندر', text: 'تم تنفيذ أمر شراء ١٠٠ سهم من COMI بسعر ٨٥٫٥٠ جنيه' },
  { title: 'ثاندر', text: 'تم تنفيذ أمر شراء 50 سهم من COMI بسعر 88.00 جنيه، عمولة 4.4' },
  { title: 'ثاندر', text: 'تم تنفيذ أمر بيع 120 سهم من COMI بسعر 92.25 جنيه' },
  { title: 'ثاندر', text: 'تم تنفيذ عملية شراء على سهم HRHO كمية 500 بسعر 18.20' },
  { title: 'ثاندر', text: 'تم تنفيذ أمر بيع 200 سهم من HRHO بسعر 19.75 جنيه' },
  { title: 'Thndr', text: 'Your buy order for 300 shares of SWDY was executed at 42.10' },
  { title: 'ثاندر', text: 'تم تنفيذ أمر شراء 1,000 سهم من ABUK بسعر 32.80 جنيه' },
  { title: 'ثاندر', text: 'السوق يفتح خلال 15 دقيقة' },
  { title: 'ثاندر', text: 'رصيدك تم تحديثه، تابع محفظتك الآن' },
];

async function send(sample, index) {
  const response = await fetch(`${BASE_URL}/api/webhook/notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      appPackage: 'com.thndr.android',
      title: sample.title ?? 'ثاندر',
      text: sample.text,
      postedAt: Date.now() - (SAMPLES.length - index) * 86_400_000,
      deviceId: 'simulator',
    }),
  });

  const json = await response.json().catch(() => ({}));
  const label = json.trade
    ? `${json.trade.side} ${json.trade.quantity} ${json.trade.symbol} @ ${json.trade.price}`
    : (json.parseError ?? json.reason ?? '');
  console.log(`${String(response.status).padEnd(4)} ${String(json.status).padEnd(9)} ${sample.text}\n     -> ${label}\n`);
}

async function main() {
  if (!API_KEY) {
    console.error('WEBHOOK_API_KEY is missing. Run this from the backend directory with a .env file present.');
    process.exit(1);
  }

  const custom = process.argv.slice(2).join(' ').trim();
  const payloads = custom ? [{ text: custom }] : SAMPLES;

  for (const [index, sample] of payloads.entries()) {
    await send(sample, index);
  }
}

main().catch((error) => {
  console.error(`Could not reach ${BASE_URL}. Is the backend running?\n`, error.message);
  process.exit(1);
});
