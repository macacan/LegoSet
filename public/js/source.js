// Var datan kommer ifrån.
// Webb: vår egen server (/api/retiring) som cachar Brickset.
// Mobilapp (Capacitor): telefonen frågar Brickset direkt med användarens nyckel
// och cachar svaret i 24 h, så det blir högst ett tiotal anrop per dygn.

import { fetchFromBrickset } from './retiring.js';

const KEY = 'legoset:apiKey';
const CACHE = 'legoset:cache';
const FAILED = 'legoset:failedAt';
const CACHE_MS = 24 * 3600 * 1000;
const RETRY_MS = 3600 * 1000;
const MIN_MANUAL_MS = 10 * 60 * 1000; // "Uppdatera nu" tidigast var 10:e minut

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

export const getApiKey = () => read(KEY) || '';
export function setApiKey(key) {
  const changed = key !== getApiKey();
  write(KEY, key || null);
  if (changed) {
    write(CACHE, null);
    write(FAILED, null);
  }
}

async function demo(note) {
  const res = await fetch('data/demo-sets.json');
  const d = await res.json();
  return { source: 'demo', note, updatedAt: d.updatedAt, sets: d.sets };
}

function cached() {
  try {
    return JSON.parse(read(CACHE));
  } catch {
    return null;
  }
}

async function loadInApp(force) {
  const apiKey = getApiKey();
  if (!apiKey) return demo('Lägg in en gratis Brickset-nyckel under ⚙ för riktig data.');

  const cache = cached();
  const age = cache ? Date.now() - new Date(cache.updatedAt).getTime() : Infinity;
  if (cache && (age < CACHE_MS && !(force && age > MIN_MANUAL_MS))) return cache;
  if (Date.now() - Number(read(FAILED) || 0) < RETRY_MS && !force) {
    return cache || demo('Brickset gick inte att nå nyss – visar exempeldata.');
  }

  try {
    const result = await fetchFromBrickset({ apiKey });
    const data = { source: 'brickset', updatedAt: new Date().toISOString(), ...result };
    write(CACHE, JSON.stringify(data));
    write(FAILED, null);
    return data;
  } catch (err) {
    write(FAILED, String(Date.now()));
    if (cache) return { ...cache, note: `Kunde inte uppdatera: ${err.message}` };
    return demo(`Kunde inte hämta från Brickset (${err.message}) – visar exempeldata.`);
  }
}

export async function loadData({ force = false } = {}) {
  if (isApp()) return loadInApp(force);
  const res = await fetch('api/retiring');
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
