#!/usr/bin/env node
/**
 * Wipes trades and notifications so you can start from a clean slate before wiring up
 * the phone. Instrument mark prices are kept unless you pass --all.
 *
 *   node scripts/reset.js
 *   node scripts/reset.js --all
 */
import { prisma } from '../src/lib/prisma.js';

const wipeInstruments = process.argv.includes('--all');

async function main() {
  const trades = await prisma.trade.deleteMany();
  const notifications = await prisma.rawNotification.deleteMany();
  const instruments = wipeInstruments ? await prisma.instrument.deleteMany() : { count: 0 };

  console.log(
    `Deleted ${trades.count} trades, ${notifications.count} notifications` +
      (wipeInstruments ? `, ${instruments.count} instruments` : ' (instruments kept)'),
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
