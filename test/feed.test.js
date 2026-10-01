import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRates } from '../scripts/build-feed.mjs';

test('fetchRates läser Frankfurter-svaret och lägger till EUR', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(url, /api\.frankfurter\.dev\/v1\/latest\?base=EUR&symbols=SEK/);
    return { ok: true, json: async () => ({ amount: 1, base: 'EUR', date: '2026-10-01', rates: { SEK: 11.2, USD: 1.1 } }) };
  };
  try {
    const r = await fetchRates();
    assert.deepEqual(r, { base: 'EUR', date: '2026-10-01', rates: { EUR: 1, SEK: 11.2, USD: 1.1 } });
  } finally {
    globalThis.fetch = real;
  }
});
