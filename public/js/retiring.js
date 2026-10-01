// Hämtar set från Bricksets gratis-API (v3) och plockar ut de som snart utgår.
// Docs: https://brickset.com/article/52664/api-version-3-documentation
//
// Delas av servern (Node) och mobilappen (körs direkt i telefonen).
// Vi är snälla mot API:et: anropen görs ett i taget med paus emellan,
// antalet sidor är begränsat och den som anropar cachar resultatet (24 h).

const API_URL = 'https://brickset.com/api/v3.asmx/getSets';
const PAGE_SIZE = 500;
const PAUSE_MS = 1500;
const DAY_MS = 24 * 60 * 60 * 1000;

// Hur långt fram/bak vi räknar som "på väg ut" resp. "nyligen utgått".
export const AHEAD_DAYS = 400;
export const RECENT_DAYS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1950 ? null : d;
}

// Brickset har både ett generellt exitDate och sista dag på LEGO.com per region.
// Vi tar exitDate i första hand, annars det senaste regionala datumet.
export function exitDateOf(set) {
  const direct = parseDate(set.exitDate);
  if (direct) return direct;
  const regional = Object.values(set.LEGOCom || {})
    .map((r) => parseDate(r?.dateLastAvailable))
    .filter(Boolean)
    .sort((a, b) => b - a);
  return regional[0] || null;
}

export function normalize(set) {
  const exit = exitDateOf(set);
  const lego = set.LEGOCom || {};
  const number = set.numberVariant ? `${set.number}-${set.numberVariant}` : set.number;
  return {
    id: set.setID,
    number: set.number,
    fullNumber: number,
    name: set.name,
    theme: set.theme || 'Övrigt',
    subtheme: set.subtheme || null,
    year: set.year,
    pieces: set.pieces ?? null,
    minifigs: set.minifigs ?? null,
    image: set.image?.imageURL || null,
    thumbnail: set.image?.thumbnailURL || null,
    bricksetURL: set.bricksetURL || `https://brickset.com/sets/${number}`,
    exitDate: exit ? exit.toISOString().slice(0, 10) : null,
    prices: {
      DE: lego.DE?.retailPrice ?? null,
      UK: lego.UK?.retailPrice ?? null,
      US: lego.US?.retailPrice ?? null,
      CA: lego.CA?.retailPrice ?? null,
    },
    rating: set.rating || null,
  };
}

// Behåll set som utgår inom AHEAD_DAYS eller utgick för max RECENT_DAYS sedan.
export function pickRetiring(rawSets, now = new Date()) {
  const from = now.getTime() - RECENT_DAYS * DAY_MS;
  const to = now.getTime() + AHEAD_DAYS * DAY_MS;
  const seen = new Set();
  return rawSets
    .filter((s) => s && s.category !== 'Gear' && s.category !== 'Book')
    .map(normalize)
    .filter((s) => {
      if (!s.exitDate || seen.has(s.id)) return false;
      seen.add(s.id);
      const t = new Date(s.exitDate).getTime();
      return t >= from && t <= to;
    })
    .sort((a, b) => a.exitDate.localeCompare(b.exitDate));
}

async function getPage(apiKey, years, pageNumber) {
  const params = JSON.stringify({ year: years.join(','), pageSize: PAGE_SIZE, pageNumber, orderBy: 'Number' });
  const url = `${API_URL}?${new URLSearchParams({ apiKey, userHash: '', params })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Brickset svarade ${res.status}`);
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`Brickset: ${body.message || 'okänt fel'}`);
  return body;
}

export async function fetchFromBrickset({ apiKey, yearsBack = 4, maxPages = 12, now = new Date() }) {
  const current = now.getUTCFullYear();
  const years = [];
  for (let y = current - yearsBack; y <= current; y++) years.push(y);

  const all = [];
  let page = 1;
  let matches = Infinity;
  while (all.length < matches && page <= maxPages) {
    if (page > 1) await sleep(PAUSE_MS);
    const body = await getPage(apiKey, years, page);
    matches = body.matches ?? 0;
    const sets = body.sets || [];
    all.push(...sets);
    if (sets.length < PAGE_SIZE) break;
    page++;
  }
  return { sets: pickRetiring(all, now), calls: page, scanned: all.length };
}

