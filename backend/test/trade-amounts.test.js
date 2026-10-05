import assert from 'node:assert/strict';
import test from 'node:test';
import Decimal from 'decimal.js';
import { amountsFor, tradeInputSchema, tradeUpdateSchema } from '../src/services/trade.service.js';

test('unknown quantity keeps net amount null and does not guess 1', () => {
  const amounts = amountsFor({
    side: 'SELL',
    quantity: null,
    price: new Decimal('2.66'),
    fees: new Decimal('0.4'),
  });

  assert.equal(amounts.quantity, null);
  assert.equal(amounts.netAmount, null);
  assert.equal(amounts.fees.toFixed(6), '0.400000');
});

test('setting a quantity recomputes net amount from side, quantity, price and fees', () => {
  const amounts = amountsFor({
    side: 'SELL',
    quantity: new Decimal('10'),
    price: new Decimal('2.66'),
    fees: new Decimal('1.25'),
  });

  assert.equal(amounts.quantity.toFixed(4), '10.0000');
  assert.equal(amounts.netAmount.toFixed(6), '25.350000');
});

test('create accepts a null quantity and update can fill it in later', () => {
  const created = tradeInputSchema.parse({
    side: 'SELL',
    symbol: 'ACTF',
    quantity: null,
    price: '2.66',
    fees: '0',
    executedAt: '2026-10-05T10:00:00.000Z',
  });
  assert.equal(created.quantity, null);

  const blank = tradeInputSchema.parse({
    side: 'BUY',
    symbol: 'XYZ',
    quantity: '',
    price: '12.5',
    executedAt: '2026-10-05T10:00:00.000Z',
  });
  assert.equal(blank.quantity, null);

  const untouched = tradeUpdateSchema.parse({ note: 'later' });
  assert.equal(untouched.quantity, undefined);

  const filled = tradeUpdateSchema.parse({ quantity: '15' });
  assert.equal(filled.quantity.toFixed(4), '15.0000');
});
