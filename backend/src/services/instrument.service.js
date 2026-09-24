import { prisma } from '../lib/prisma.js';

export async function upsertInstrument(code, tx = prisma) {
  if (!code) return null;
  return tx.instrument.upsert({
    where: { code },
    update: {},
    create: { code },
  });
}

export async function listInstruments() {
  return prisma.instrument.findMany({ orderBy: { code: 'asc' } });
}

export async function setMarkPrice(code, { markPrice, nameAr, nameEn }) {
  const data = {};
  if (markPrice !== undefined) {
    data.markPrice = markPrice;
    data.markPriceUpdatedAt = markPrice === null ? null : new Date();
  }
  if (nameAr !== undefined) data.nameAr = nameAr;
  if (nameEn !== undefined) data.nameEn = nameEn;

  return prisma.instrument.upsert({
    where: { code },
    update: data,
    create: { code, ...data },
  });
}
