import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNotification } from '../src/services/parser/index.js';

const ACTF_TITLE = '🇪🇬 ACTF order';
const ACTF_BODY = 'Your ACTF limit sell order executed at 2.66';

test('Thndr English limit sell with no share count is a parsed trade of unknown quantity', () => {
  const result = parseNotification({
    title: ACTF_TITLE,
    body: ACTF_BODY,
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.ruleId, 'en-thndr-limit-market-fill');
  assert.equal(result.error, null);
  assert.equal(result.trade.side, 'SELL');
  assert.equal(result.trade.symbol, 'ACTF');
  assert.equal(result.trade.price, '2.660000');
  assert.equal(result.trade.quantity, null);
  assert.equal(result.trade.netAmount, null);
  assert.equal(result.trade.fees, '0.000000');
});

test('Thndr English limit buy with no share count parses the same way', () => {
  const result = parseNotification({
    body: 'Your XYZ limit buy order executed at 12.5',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.ruleId, 'en-thndr-limit-market-fill');
  assert.equal(result.trade.side, 'BUY');
  assert.equal(result.trade.symbol, 'XYZ');
  assert.equal(result.trade.price, '12.500000');
  assert.equal(result.trade.quantity, null);
  assert.equal(result.trade.netAmount, null);
});

test('market orders use the same English shape', () => {
  const result = parseNotification({
    body: 'Your HRHO market buy order executed at 18.2',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.trade.side, 'BUY');
  assert.equal(result.trade.symbol, 'HRHO');
  assert.equal(result.trade.price, '18.200000');
  assert.equal(result.trade.quantity, null);
  assert.equal(result.trade.netAmount, null);
});

test('symbol may come from the title when the body omits it', () => {
  const result = parseNotification({
    title: '🇪🇬 COMI order',
    body: 'Your limit sell order executed at 85.5',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.trade.side, 'SELL');
  assert.equal(result.trade.symbol, 'COMI');
  assert.equal(result.trade.quantity, null);
});

test('a share count on the new English shape is kept and the net amount is computed', () => {
  const result = parseNotification({
    body: 'Your ACTF limit sell order for 10 shares executed at 2.66 commission 1.25',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.ruleId, 'en-thndr-limit-market-fill');
  assert.equal(result.trade.side, 'SELL');
  assert.equal(result.trade.symbol, 'ACTF');
  assert.equal(result.trade.quantity, '10.0000');
  assert.equal(result.trade.price, '2.660000');
  assert.equal(result.trade.fees, '1.250000');
  assert.equal(result.trade.netAmount, '25.350000');
});

test('fees on a quantity-less fill are kept and do not invent a net amount', () => {
  const result = parseNotification({
    title: ACTF_TITLE,
    body: 'Your ACTF limit sell order executed at 2.66 commission 0.4',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.trade.quantity, null);
  assert.equal(result.trade.netAmount, null);
  assert.equal(result.trade.fees, '0.400000');
});

test('existing English fill that names a quantity still parses', () => {
  const result = parseNotification({
    title: 'Thndr',
    body: 'Your buy order for 300 shares of SWDY was executed at 42.10',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.ruleId, 'en-order-executed');
  assert.equal(result.trade.side, 'BUY');
  assert.equal(result.trade.symbol, 'SWDY');
  assert.equal(result.trade.quantity, '300.0000');
  assert.equal(result.trade.price, '42.100000');
  assert.equal(result.trade.netAmount, '12630.000000');
});

test('existing Arabic fill that names a quantity still parses', () => {
  const result = parseNotification({
    body: 'تم تنفيذ أمر شراء 100 سهم من COMI بسعر 85.50',
  });

  assert.equal(result.status, 'PARSED');
  assert.equal(result.ruleId, 'ar-executed-qty-symbol-price');
  assert.equal(result.trade.side, 'BUY');
  assert.equal(result.trade.symbol, 'COMI');
  assert.equal(result.trade.quantity, '100.0000');
  assert.equal(result.trade.price, '85.500000');
});

test('bank transfer and deposit texts stay ignored', () => {
  const transfer = parseNotification({ body: 'تم تحويل 1500 جنيه الى حسابك البنكي' });
  const deposit = parseNotification({ body: 'Your deposit of 500 EGP was received' });
  const instapay = parseNotification({ body: 'InstaPay transfer of 200 EGP completed' });

  assert.equal(transfer.status, 'IGNORED');
  assert.equal(deposit.status, 'IGNORED');
  assert.equal(instapay.status, 'IGNORED');
});

test('a side and a price without the Thndr fill shape is not guessed as quantity 1', () => {
  const result = parseNotification({ body: 'I will sell COMI at 2.66' });
  assert.notEqual(result.status, 'PARSED');
  assert.equal(result.trade, null);
});
