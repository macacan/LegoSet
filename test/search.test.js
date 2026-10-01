import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from '../public/js/source.js';

const mk = (num, name, theme = 'Icons') => ({ num, number: num.replace(/-1$/, ''), name, theme, year: 2022, pieces: 100 });
const catalog = { sets: [mk('103050-1', 'Other'), mk('10305-1', "Lion Knights' Castle"), mk('10305-2', 'Variant'), mk('75192-1', 'Millennium Falcon', 'Star Wars')] };

test('exakt setnummer kommer först, sedan nummer som börjar likadant', () => {
  assert.deepEqual(searchCatalog(catalog, '10305').map((s) => s.num), ['10305-1', '103050-1', '10305-2']);
  assert.deepEqual(searchCatalog(catalog, '10305-2').map((s) => s.num), ['10305-2']);
});

test('för korta nummer ger inga träffar', () => {
  assert.deepEqual(searchCatalog(catalog, '10'), []);
});

test('sök på namn och tema, alla ord måste finnas', () => {
  assert.deepEqual(searchCatalog(catalog, 'falcon').map((s) => s.num), ['75192-1']);
  assert.deepEqual(searchCatalog(catalog, 'star wars millennium').map((s) => s.num), ['75192-1']);
  assert.deepEqual(searchCatalog(catalog, 'castle star'), []);
});
