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
