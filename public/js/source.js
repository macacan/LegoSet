// Var datan kommer ifrån.
//
// Ingen telefon pratar med Brickset. En gång per dygn hämtar GitHub Actions
// datan och lägger en färdig fil (retiring.json) på grenen "data", som serveras
// gratis via jsDelivr-CDN. Appen hämtar filen, sparar den i telefonen och
// frågar högst var 6:e timme – så 10 000 användare ger fortfarande bara
// ~10 Brickset-anrop per dygn.

const REPO = 'macacan/LegoSet';
export const FEED_URLS = [
  `https://cdn.jsdelivr.net/gh/${REPO}@data/retiring.json`,
  `https://raw.githubusercontent.com/${REPO}/data/retiring.json`,
];

const CACHE = 'legoset:feed';
const CHECKED = 'legoset:feedCheckedAt';
const REFRESH_MS = 6 * 3600 * 1000;
const MIN_MANUAL_MS = 5 * 60 * 1000;

export const isApp = () => Boolean(window.Capacitor?.isNativePlatform?.());

function read(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k, v) {
  try {
    v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
  } catch {}
}

function cached() {
  try {
    return JSON.parse(read(CACHE));
  } catch {
    return null;
  }
}

async function demo() {
  try {
    const d = await (await fetch('data/demo-sets.json')).json();
    return { source: 'demo', offline: true, updatedAt: d.updatedAt, sets: d.sets };
  } catch {
    return { source: 'none', offline: true, sets: [] };
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.sets)) throw new Error('ogiltig fil');
  return body;
}

async function fetchFeed() {
  // Webbversionen med egen server (npm start) har /api/retiring.
  if (!isApp() && location.protocol.startsWith('http')) {
    try {
      return await fetchJson('api/retiring');
    } catch {}
  }
  let lastErr;
  for (const url of FEED_URLS) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function loadData({ force = false } = {}) {
  const cache = cached();
  const since = Date.now() - Number(read(CHECKED) || 0);
  if (cache && since < (force ? MIN_MANUAL_MS : REFRESH_MS)) return cache;

  try {
    const feed = await fetchFeed();
    write(CACHE, JSON.stringify(feed));
    write(CHECKED, String(Date.now()));
    return feed;
  } catch (err) {
    console.warn('Kunde inte hämta listan:', err?.message);
    if (cache) return { ...cache, offline: true };
    return demo();
  }
}

export function lastChecked() {
  const t = Number(read(CHECKED) || 0);
  return t ? new Date(t) : null;
}

// ---------- Katalog över alla set (för sökning och "Min samling") ----------
// Hämtas först när den behövs, sparas i telefonens cache och förnyas en gång i veckan.

export const CATALOG_URLS = FEED_URLS.map((u) => u.replace('retiring.json', 'catalog.json'));
const CATALOG_KEY = 'https://klosskoll.local/catalog.json';
const CATALOG_MAX_AGE = 7 * 24 * 3600 * 1000;
let catalogPromise = null;

async function openCache() {
  try {
    return 'caches' in window ? await caches.open('klosskoll-v1') : null;
  } catch {
    return null;
  }
}

function indexCatalog(raw) {
  const sets = raw.sets.map(([num, name, year, t, pieces]) => ({ num, number: num.replace(/-1$/, ''), name, year, theme: raw.themes[t], pieces }));
  return { sets, byNum: new Map(sets.map((s) => [s.num, s])) };
}

export function loadCatalog() {
  catalogPromise ||= (async () => {
    const cache = await openCache();
    const stored = cache && (await cache.match(CATALOG_KEY).catch(() => null));
    const age = stored ? Date.now() - Number(stored.headers.get('x-saved-at') || 0) : Infinity;
    if (stored && age < CATALOG_MAX_AGE) return indexCatalog(await stored.json());

    for (const url of CATALOG_URLS) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const text = await res.text();
        const raw = JSON.parse(text);
        if (!Array.isArray(raw.sets)) continue;
        cache?.put(CATALOG_KEY, new Response(text, { headers: { 'content-type': 'application/json', 'x-saved-at': String(Date.now()) } })).catch(() => {});
        return indexCatalog(raw);
      } catch {}
    }
    if (stored) return indexCatalog(await stored.json());
    catalogPromise = null; // försök igen nästa gång
    return null;
  })();
  return catalogPromise;
}

// Sök i katalogen: setnummer (t.ex. "10305" eller "10305-1") eller ord i namnet.
export function searchCatalog(catalog, query, limit = 24) {
  const q = query.trim().toLowerCase();
  if (!catalog || q.length < 2) return [];
  if (/^\d+(-\d+)?$/.test(q)) {
    if (q.length < 3) return [];
    const exact = [];
    const prefix = [];
    for (const s of catalog.sets) {
      if (s.num === q || s.number === q) exact.push(s);
      else if (s.num.startsWith(q)) prefix.push(s);
      if (exact.length + prefix.length > 400) break;
    }
    return [...exact, ...prefix].slice(0, limit);
  }
  if (q.length < 3) return [];
  const words = q.split(/\s+/);
  const out = [];
  for (const s of catalog.sets) {
    const hay = `${s.name} ${s.theme}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
