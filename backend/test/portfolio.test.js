import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSymbolPosition } from '../src/services/portfolio.js';

function trade(overrides) {
  return {
    side: 'BUY',
    quantity: '10',
    price: '5',
    fees: '0',
    netAmount: '50',
    executedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

test('an unknown-quantity trade is listed and does not change open quantity', () => {
  const position = computeSymbolPosition('ACTF', [
    trade({ executedAt: new Date('2026-01-01T10:00:00Z') }),
    trade({
      side: 'SELL',
      quantity: null,
      price: '2.66',
      fees: '0.4',
      netAmount: null,
      executedAt: new Date('2026-01-02T10:00:00Z'),
    }),
    trade({
      side: 'SELL',
      quantity: '4',
      price: '6',
      fees: '0',
      netAmount: '24',
      executedAt: new Date('2026-01-03T10:00:00Z'),
    }),
  ]);

  assert.equal(position.quantity.toFixed(4), '6.0000');
  assert.equal(position.buyQty.toFixed(4), '10.0000');
  assert.equal(position.sellQty.toFixed(4), '4.0000');
  assert.equal(position.tradeCount, 3);
  assert.equal(position.realizedPnl.toFixed(2), '4.00');

  const warning = position.warnings.find((item) => item.code === 'UNKNOWN_QUANTITY');
  assert.ok(warning);
  assert.equal(warning.count, 1);
  assert.equal(
    position.warnings.some((item) => item.code === 'UNMATCHED_SELL'),
    false,
  );
});

test('a symbol that only has unknown-quantity trades stays at zero open quantity', () => {
  const position = computeSymbolPosition('ACTF', [
    trade({
      side: 'SELL',
      quantity: null,
      price: '2.66',
      fees: '1',
      netAmount: null,
    }),
  ]);

  assert.equal(position.quantity.toFixed(4), '0.0000');
  assert.equal(position.buyQty.toFixed(4), '0.0000');
  assert.equal(position.sellQty.toFixed(4), '0.0000');
  assert.equal(position.tradeCount, 1);
  assert.deepEqual(position.warnings, [{ code: 'UNKNOWN_QUANTITY', count: 1 }]);
});
