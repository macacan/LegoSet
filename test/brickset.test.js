import test from 'node:test';
import assert from 'node:assert/strict';
import { exitDateOf, normalize, pickRetiring } from '../lib/brickset.js';

const now = new Date('2026-10-01T00:00:00Z');
const raw = (id, extra) => ({ setID: id, number: String(id), numberVariant: 1, name: `Set ${id}`, theme: 'City', year: 2024, ...extra });

test('exitDate föredras, annars senaste LEGO.com-datum', () => {
  assert.equal(exitDateOf({ exitDate: '2026-12-31T00:00:00Z' }).toISOString().slice(0, 10), '2026-12-31');
  const d = exitDateOf({ LEGOCom: { US: { dateLastAvailable: '2026-11-01T00:00:00Z' }, UK: { dateLastAvailable: '2027-01-15T00:00:00Z' }, CA: {} } });
  assert.equal(d.toISOString().slice(0, 10), '2027-01-15');
  assert.equal(exitDateOf({ exitDate: '0001-01-01T00:00:00' }), null);
});

test('pickRetiring behåller kommande och nyss utgångna, sorterat', () => {
  const sets = [
    raw(1, { exitDate: '2027-06-30T00:00:00Z' }),
    raw(2, { exitDate: '2026-12-31T00:00:00Z' }),
    raw(3, { exitDate: '2026-08-01T00:00:00Z' }), // nyss utgått
    raw(4, { exitDate: '2024-12-31T00:00:00Z' }), // för gammalt
    raw(5, {}), // inget datum
    raw(6, { exitDate: '2030-01-01T00:00:00Z' }), // för långt fram
    raw(2, { exitDate: '2026-12-31T00:00:00Z' }), // dubblett
    raw(7, { exitDate: '2026-12-31T00:00:00Z', category: 'Gear' }),
  ];
  assert.deepEqual(pickRetiring(sets, now).map((s) => s.id), [3, 2, 1]);
});

test('normalize ger fält som frontenden behöver', () => {
  const s = normalize(raw(9, { exitDate: '2026-12-31T00:00:00Z', image: { imageURL: 'x.jpg' }, LEGOCom: { DE: { retailPrice: 49.99 } } }));
  assert.equal(s.fullNumber, '9-1');
  assert.equal(s.image, 'x.jpg');
  assert.equal(s.prices.DE, 49.99);
  assert.equal(s.exitDate, '2026-12-31');
});

test('fetchFromBrickset bläddrar sidor och slutar när allt är hämtat', async () => {
  const { fetchFromBrickset } = await import('../lib/brickset.js');
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const params = JSON.parse(new URL(url).searchParams.get('params'));
    calls.push(params);
    const sets = params.pageNumber === 1
      ? Array.from({ length: 500 }, (_, i) => raw(i + 1, { exitDate: i === 0 ? '2026-12-31T00:00:00Z' : null }))
      : [raw(999, { exitDate: '2027-02-01T00:00:00Z' })];
    return { ok: true, json: async () => ({ status: 'success', matches: 501, sets }) };
  };
  try {
    const r = await fetchFromBrickset({ apiKey: 'k', yearsBack: 2, maxPages: 5, now });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].year, '2024,2025,2026');
    assert.deepEqual(r.sets.map((s) => s.id), [1, 999]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
