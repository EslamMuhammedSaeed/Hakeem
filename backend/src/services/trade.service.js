import Decimal from 'decimal.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitTradeChanged } from './events.js';
import { upsertInstrument } from './instrument.service.js';

/**
 * Bounds are checked inside the transform rather than with a chained `.refine`, because
 * a refine would still run on the failure sentinel and blow up on a non-Decimal value.
 */
function decimalField({ gt, gte } = {}) {
  return z.union([z.number(), z.string()]).transform((value, ctx) => {
    const fail = (message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, fatal: true });
      return z.NEVER;
    };

    let decimal;
    try {
      decimal = new Decimal(String(value).trim());
    } catch {
      return fail(`"${value}" is not a valid number`);
    }

    if (!decimal.isFinite()) return fail(`"${value}" is not a finite number`);
    if (gt !== undefined && !decimal.gt(gt)) return fail(`Value must be greater than ${gt}`);
    if (gte !== undefined && !decimal.gte(gte)) return fail(`Value cannot be below ${gte}`);
    return decimal;
  });
}

const nullableQuantityField = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  decimalField({ gt: 0 }).nullable(),
);

export const tradeInputSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  symbol: z.string().trim().min(1).max(32),
  quantity: nullableQuantityField,
  price: decimalField({ gte: 0 }),
  fees: decimalField({ gte: 0 }).optional(),
  executedAt: z.coerce.date(),
  note: z.string().max(1000).optional().nullable(),
});

export const tradeUpdateSchema = tradeInputSchema.partial();

export const tradeQuerySchema = z.object({
  symbol: z.string().trim().optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  source: z.enum(['NOTIFICATION', 'MANUAL']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  sort: z.enum(['executedAt', 'symbol', 'netAmount']).default('executedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

function computeNetAmount({ side, quantity, price, fees }) {
  const gross = quantity.times(price);
  return side === 'BUY' ? gross.plus(fees) : gross.minus(fees);
}

/**
 * Quantity may be null (unknown share count). Net amount is only defined once
 * quantity, price and fees are all known.
 */
export function amountsFor({ side, quantity, price, fees }) {
  const feeValue = fees ?? new Decimal(0);
  if (quantity == null) {
    return { quantity: null, fees: feeValue, netAmount: null };
  }
  return {
    quantity,
    fees: feeValue,
    netAmount: computeNetAmount({ side, quantity, price, fees: feeValue }),
  };
}

export function buildTradeWhere(filters) {
  const where = {};
  if (filters.symbol) where.symbol = filters.symbol.toUpperCase();
  if (filters.side) where.side = filters.side;
  if (filters.source) where.source = filters.source;
  if (filters.from || filters.to) {
    where.executedAt = {};
    if (filters.from) where.executedAt.gte = filters.from;
    if (filters.to) where.executedAt.lte = filters.to;
  }
  if (filters.q) {
    where.OR = [{ symbol: { contains: filters.q } }, { note: { contains: filters.q } }];
  }
  return where;
}

export async function listTrades(filters) {
  const where = buildTradeWhere(filters);
  const [items, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: [{ [filters.sort]: filters.order }, { id: filters.order }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.trade.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export async function createTrade(input) {
  const symbol = input.symbol.toUpperCase();
  const amounts = amountsFor({
    side: input.side,
    quantity: input.quantity,
    price: input.price,
    fees: input.fees,
  });
  const trade = await prisma.trade.create({
    data: {
      source: 'MANUAL',
      side: input.side,
      symbol,
      quantity: amounts.quantity == null ? null : amounts.quantity.toFixed(4),
      price: input.price.toFixed(6),
      fees: amounts.fees.toFixed(6),
      netAmount: amounts.netAmount == null ? null : amounts.netAmount.toFixed(6),
      executedAt: input.executedAt,
      note: input.note ?? null,
    },
  });
  await upsertInstrument(symbol);
  emitTradeChanged({ reason: 'create', tradeId: trade.id });
  return trade;
}

export async function updateTrade(id, input) {
  const current = await prisma.trade.findUnique({ where: { id } });
  if (!current) return null;

  const quantity =
    input.quantity === undefined
      ? current.quantity == null
        ? null
        : new Decimal(current.quantity.toString())
      : input.quantity;
  const price = input.price ?? new Decimal(current.price.toString());
  const fees = input.fees ?? new Decimal(current.fees.toString());
  const side = input.side ?? current.side;
  const symbol = (input.symbol ?? current.symbol).toUpperCase();
  const amounts = amountsFor({ side, quantity, price, fees });

  const trade = await prisma.trade.update({
    where: { id },
    data: {
      side,
      symbol,
      quantity: amounts.quantity == null ? null : amounts.quantity.toFixed(4),
      price: price.toFixed(6),
      fees: amounts.fees.toFixed(6),
      netAmount: amounts.netAmount == null ? null : amounts.netAmount.toFixed(6),
      executedAt: input.executedAt ?? current.executedAt,
      note: input.note === undefined ? current.note : input.note,
    },
  });
  await upsertInstrument(symbol);
  emitTradeChanged({ reason: 'update', tradeId: id });
  return trade;
}

export async function deleteTrade(id) {
  await prisma.trade.delete({ where: { id } });
  emitTradeChanged({ reason: 'delete', tradeId: id });
}
