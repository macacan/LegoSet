// Bygger den delade datafilen som alla appar läser (feed/retiring.json).
// Körs en gång per dygn av GitHub Actions – det är bara här Brickset anropas,
// så antalet anrop är detsamma oavsett hur många som använder appen.
//
//   BRICKSET_API_KEY=... node scripts/build-feed.mjs
//
// Utan nyckel byggs filen av exempeldatan (bra för att testa kedjan).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFromBrickset } from '../public/js/retiring.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'feed');
export const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK', 'CAD'];

// Växelkurser från ECB via Frankfurter (gratis, ingen nyckel). Bas: EUR.
export async function fetchRates() {
  const symbols = CURRENCIES.filter((c) => c !== 'EUR').join(',');
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${symbols}`);
  if (!res.ok) throw new Error(`Frankfurter svarade ${res.status}`);
  const body = await res.json();
  return { base: 'EUR', date: body.date, rates: { EUR: 1, ...body.rates } };
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(path.join(outDir, 'retiring.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const apiKey = process.env.BRICKSET_API_KEY?.trim();
  const previous = await readPrevious();

  let rates = null;
  try {
    rates = await fetchRates();
  } catch (err) {
    console.warn(`Växelkurser: ${err.message} – behåller gamla.`);
    rates = previous?.currency || null;
  }

  // Spärr: Brickset tillåter 100 anrop/dygn. Om datan redan hämtats de senaste
  // 20 timmarna (t.ex. vid flera pushar eller manuella körningar samma dag)
  // återanvänds den. FORCE=1 tvingar fram en ny hämtning.
  const age = previous?.updatedAt ? Date.now() - new Date(previous.updatedAt).getTime() : Infinity;
  const recent = apiKey && previous?.source === 'brickset' && age < 20 * 3600 * 1000 && process.env.FORCE !== '1';

  let feed;
  if (recent) {
    console.log(`Brickset-data är ${Math.round(age / 3600000)} h gammal – återanvänder den (inga anrop).`);
    feed = { source: 'brickset', updatedAt: previous.updatedAt, sets: previous.sets };
  } else if (apiKey) {
    const result = await fetchFromBrickset({
      apiKey,
      yearsBack: Number(process.env.YEARS_BACK) || 9,
      maxPages: Number(process.env.MAX_PAGES) || 40,
    });
    console.log(`Brickset: ${result.calls} anrop, ${result.scanned} av ${result.matches} set lästa, ${result.sets.length} på väg ut.`);
    if (result.scanned < result.matches) console.warn('::warning::Alla set hann inte läsas – höj MAX_PAGES.');
    feed = { source: 'brickset', updatedAt: new Date().toISOString(), sets: result.sets };
  } else {
    console.warn('Ingen BRICKSET_API_KEY – bygger från exempeldata.');
    const demo = JSON.parse(await readFile(path.join(root, 'public', 'data', 'demo-sets.json'), 'utf8'));
    feed = {
      source: 'demo',
      note: 'Exempeldata – riktig data kommer när BRICKSET_API_KEY är inlagd.',
      updatedAt: new Date().toISOString(),
      sets: demo.sets,
    };
  }

  feed.version = 1;
  feed.currency = rates;
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'retiring.json'), JSON.stringify(feed));
  console.log(`Skrev feed/retiring.json (${feed.sets.length} set, källa: ${feed.source}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
