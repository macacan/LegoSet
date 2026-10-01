// Serverns disk-cache runt Brickset-hämtningen (själva logiken ligger i public/js/retiring.js).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchFromBrickset } from '../public/js/retiring.js';

export * from '../public/js/retiring.js';

// Disk-cache så vi bara frågar Brickset en gång per CACHE_HOURS.
export function createStore({ apiKey, cacheDir, cacheHours = 24, yearsBack, maxPages, demoFile }) {
  const cacheFile = path.join(cacheDir, 'retiring.json');
  let memory = null;
  let inflight = null;
  let failedAt = 0; // efter ett fel väntar vi en timme innan nästa försök

  async function readCache() {
    try {
      return JSON.parse(await readFile(cacheFile, 'utf8'));
    } catch {
      return null;
    }
  }

  async function loadDemo(note) {
    const demo = JSON.parse(await readFile(demoFile, 'utf8'));
    return { source: 'demo', note, updatedAt: demo.updatedAt, sets: demo.sets };
  }

  async function refresh() {
    const result = await fetchFromBrickset({ apiKey, yearsBack, maxPages });
    const data = { source: 'brickset', updatedAt: new Date().toISOString(), ...result };
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(data));
    console.log(`Brickset: ${result.calls} anrop, ${result.scanned} set lästa, ${result.sets.length} på väg ut.`);
    return data;
  }

  return async function get() {
    if (!apiKey) return loadDemo('Ingen BRICKSET_API_KEY satt – visar exempeldata.');

    memory ||= await readCache();
    const fresh = memory && Date.now() - new Date(memory.updatedAt).getTime() < cacheHours * 3600 * 1000;
    if (fresh) return memory;
    if (Date.now() - failedAt < 3600 * 1000) {
      return memory || loadDemo('Brickset gick inte att nå nyss – visar exempeldata.');
    }

    inflight ||= refresh()
      .then((data) => (memory = data))
      .finally(() => (inflight = null));
    try {
      return await inflight;
    } catch (err) {
      failedAt = Date.now();
      console.error(err.message);
      // Hellre gammal data än ingen data.
      if (memory) return { ...memory, note: `Kunde inte uppdatera: ${err.message}` };
      return loadDemo(`Kunde inte hämta från Brickset (${err.message}) – visar exempeldata.`);
    }
  };
}
