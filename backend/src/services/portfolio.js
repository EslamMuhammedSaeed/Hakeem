import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma.js';

const ZERO = new Decimal(0);

function toDecimal(value) {
  return new Decimal(value?.toString() ?? '0');
}

/**
 * Unit economics include commission: a buy lot carries its fee in the cost basis and a
 * sale nets its fee out of the proceeds, so realized P&L is already fee-adjusted.
 */
function unitCost(trade) {
  const quantity = toDecimal(trade.quantity);
  if (quantity.isZero()) return ZERO;
  return toDecimal(trade.netAmount).div(quantity);
}

/**
 * FIFO lot matching over a chronologically sorted trade list for a single symbol.
 */
export function computeSymbolPosition(symbol, trades) {
  const lots = [];
  let realizedPnl = ZERO;
  let buyQty = ZERO;
  let sellQty = ZERO;
  let totalFees = ZERO;
  let unmatchedSellQty = ZERO;
  let lastPrice = null;
  let lastTradeAt = null;

  for (const trade of trades) {
    const quantity = toDecimal(trade.quantity);
    totalFees = totalFees.plus(toDecimal(trade.fees));
    lastPrice = toDecimal(trade.price);
    lastTradeAt = trade.executedAt;

    if (trade.side === 'BUY') {
      buyQty = buyQty.plus(quantity);
      lots.push({ quantity, unitCost: unitCost(trade) });
      continue;
    }

    sellQty = sellQty.plus(quantity);
    let remaining = quantity;
    const proceedsPerUnit = unitCost(trade);

    while (remaining.gt(0) && lots.length > 0) {
      const lot = lots[0];
      const matched = Decimal.min(remaining, lot.quantity);
      realizedPnl = realizedPnl.plus(proceedsPerUnit.minus(lot.unitCost).times(matched));
      lot.quantity = lot.quantity.minus(matched);
      remaining = remaining.minus(matched);
      if (lot.quantity.lte(0)) lots.shift();
    }

    // Sold more than we know about - the matching buy predates what we have captured
    if (remaining.gt(0)) unmatchedSellQty = unmatchedSellQty.plus(remaining);
  }

  const openQuantity = lots.reduce((sum, lot) => sum.plus(lot.quantity), ZERO);
  const costBasis = lots.reduce((sum, lot) => sum.plus(lot.quantity.times(lot.unitCost)), ZERO);
  const avgCost = openQuantity.gt(0) ? costBasis.div(openQuantity) : ZERO;

  const warnings = [];
  if (unmatchedSellQty.gt(0)) {
    warnings.push({ code: 'UNMATCHED_SELL', quantity: unmatchedSellQty.toFixed(2) });
  }

  return {
    symbol,
    quantity: openQuantity,
    avgCost,
    costBasis,
    realizedPnl,
    buyQty,
    sellQty,
    totalFees,
    lastPrice,
    lastTradeAt,
    tradeCount: trades.length,
    warnings,
  };
}

function withMarkPrice(position, instrument) {
  // No price feed exists for EGX here, so a manually set mark price wins and the last
  // traded price is the fallback.
  const markPrice = instrument?.markPrice ? toDecimal(instrument.markPrice) : position.lastPrice ?? ZERO;
  const markSource = instrument?.markPrice ? 'manual' : position.lastPrice ? 'lastTrade' : 'none';
  const marketValue = position.quantity.times(markPrice);
  const unrealizedPnl = position.quantity.gt(0) ? marketValue.minus(position.costBasis) : ZERO;
  const unrealizedPct = position.costBasis.gt(0) ? unrealizedPnl.div(position.costBasis).times(100) : ZERO;

  return {
    symbol: position.symbol,
    nameAr: instrument?.nameAr ?? null,
    nameEn: instrument?.nameEn ?? null,
    quantity: position.quantity.toFixed(4),
    avgCost: position.avgCost.toFixed(6),
    costBasis: position.costBasis.toFixed(2),
    markPrice: markPrice.toFixed(6),
    markSource,
    markPriceUpdatedAt: instrument?.markPriceUpdatedAt ?? null,
    marketValue: marketValue.toFixed(2),
    unrealizedPnl: unrealizedPnl.toFixed(2),
    unrealizedPct: unrealizedPct.toFixed(2),
    realizedPnl: position.realizedPnl.toFixed(2),
    totalPnl: position.realizedPnl.plus(unrealizedPnl).toFixed(2),
    buyQty: position.buyQty.toFixed(4),
    sellQty: position.sellQty.toFixed(4),
    totalFees: position.totalFees.toFixed(2),
    lastPrice: position.lastPrice ? position.lastPrice.toFixed(6) : null,
    lastTradeAt: position.lastTradeAt,
    tradeCount: position.tradeCount,
    isOpen: position.quantity.gt(0),
    warnings: position.warnings,
  };
}

export async function getPositions({ includeClosed = true } = {}) {
  const [trades, instruments] = await Promise.all([
    prisma.trade.findMany({ orderBy: [{ executedAt: 'asc' }, { id: 'asc' }] }),
    prisma.instrument.findMany(),
  ]);

  const instrumentByCode = new Map(instruments.map((item) => [item.code, item]));
  const bySymbol = new Map();
  for (const trade of trades) {
    if (!bySymbol.has(trade.symbol)) bySymbol.set(trade.symbol, []);
    bySymbol.get(trade.symbol).push(trade);
  }

  const positions = [...bySymbol.entries()]
    .map(([symbol, symbolTrades]) => withMarkPrice(computeSymbolPosition(symbol, symbolTrades), instrumentByCode.get(symbol)))
    .filter((position) => includeClosed || position.isOpen)
    .sort((a, b) => Number(b.marketValue) - Number(a.marketValue) || a.symbol.localeCompare(b.symbol));

  return positions;
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function getSummary() {
  const positions = await getPositions();

  const totals = positions.reduce(
    (acc, position) => ({
      realizedPnl: acc.realizedPnl.plus(position.realizedPnl),
      unrealizedPnl: acc.unrealizedPnl.plus(position.unrealizedPnl),
      marketValue: acc.marketValue.plus(position.isOpen ? position.marketValue : 0),
      costBasis: acc.costBasis.plus(position.costBasis),
      fees: acc.fees.plus(position.totalFees),
    }),
    { realizedPnl: ZERO, unrealizedPnl: ZERO, marketValue: ZERO, costBasis: ZERO, fees: ZERO },
  );

  const [trades, tradeCount, notificationCounts] = await Promise.all([
    prisma.trade.findMany({ orderBy: [{ executedAt: 'asc' }, { id: 'asc' }] }),
    prisma.trade.count(),
    prisma.rawNotification.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  // Daily realized P&L, computed by replaying FIFO per symbol and stamping each sale
  const realizedByDay = new Map();
  const bySymbol = new Map();
  for (const trade of trades) {
    if (!bySymbol.has(trade.symbol)) bySymbol.set(trade.symbol, []);
    bySymbol.get(trade.symbol).push(trade);
  }

  for (const symbolTrades of bySymbol.values()) {
    const lots = [];
    for (const trade of symbolTrades) {
      const quantity = toDecimal(trade.quantity);
      if (trade.side === 'BUY') {
        lots.push({ quantity, unitCost: unitCost(trade) });
        continue;
      }
      let remaining = quantity;
      const proceedsPerUnit = unitCost(trade);
      let dayPnl = ZERO;
      while (remaining.gt(0) && lots.length > 0) {
        const lot = lots[0];
        const matched = Decimal.min(remaining, lot.quantity);
        dayPnl = dayPnl.plus(proceedsPerUnit.minus(lot.unitCost).times(matched));
        lot.quantity = lot.quantity.minus(matched);
        remaining = remaining.minus(matched);
        if (lot.quantity.lte(0)) lots.shift();
      }
      const key = dayKey(trade.executedAt);
      realizedByDay.set(key, (realizedByDay.get(key) ?? ZERO).plus(dayPnl));
    }
  }

  let running = ZERO;
  const pnlSeries = [...realizedByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => {
      running = running.plus(value);
      return { date, realized: value.toFixed(2), cumulative: running.toFixed(2) };
    });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tradesToday = trades.filter((trade) => new Date(trade.executedAt) >= startOfToday).length;

  const openPositions = positions.filter((position) => position.isOpen);

  return {
    realizedPnl: totals.realizedPnl.toFixed(2),
    unrealizedPnl: totals.unrealizedPnl.toFixed(2),
    totalPnl: totals.realizedPnl.plus(totals.unrealizedPnl).toFixed(2),
    marketValue: totals.marketValue.toFixed(2),
    costBasis: totals.costBasis.toFixed(2),
    totalFees: totals.fees.toFixed(2),
    tradeCount,
    tradesToday,
    openPositionCount: openPositions.length,
    symbolCount: positions.length,
    pnlSeries,
    notificationCounts: Object.fromEntries(notificationCounts.map((row) => [row.status, row._count._all])),
    topPositions: openPositions.slice(0, 5),
    currency: 'EGP',
  };
}
