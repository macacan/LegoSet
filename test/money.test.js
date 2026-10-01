import test from 'node:test';
import assert from 'node:assert/strict';
import { priceIn } from '../public/js/money.js';

const fx = { base: 'EUR', date: '2026-10-01', rates: { EUR: 1, SEK: 11, USD: 1.1, GBP: 0.85, NOK: 11.5, DKK: 7.46, CAD: 1.5 } };
const nbsp = (s) => s.replace(/\s/g, ' ');

test('riktigt listpris när valutan har en LEGO-region', () => {
  const p = priceIn({ DE: 100, US: 120 }, 'USD', fx);
  assert.equal(p.exact, true);
  assert.equal(p.amount, 120);
});

test('SEK räknas om från europriset och märks med ≈', () => {
  const p = priceIn({ DE: 169.99 }, 'SEK', fx);
  assert.equal(p.exact, false);
  assert.equal(Math.round(p.amount), 1870);
  assert.equal(nbsp(p.text), '≈ 1 870 kr');
});

test('räknar om från USD om europris saknas', () => {
  const p = priceIn({ US: 110 }, 'SEK', fx);
  assert.equal(Math.round(p.amount), 1100);
});

test('inget pris eller inga kurser ger null', () => {
  assert.equal(priceIn({}, 'SEK', fx), null);
  assert.equal(priceIn({ DE: 10 }, 'SEK', null), null);
});
