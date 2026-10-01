import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './lib/brickset.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// Läs .env om den finns (utan extra beroenden).
try {
  for (const line of (await readFile(path.join(root, '.env'), 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}

const env = process.env;
const getData = createStore({
  apiKey: env.BRICKSET_API_KEY?.trim(),
  cacheDir: path.join(root, 'cache'),
  cacheHours: Number(env.CACHE_HOURS) || 24,
  yearsBack: Number(env.YEARS_BACK) || 4,
  maxPages: Number(env.MAX_PAGES) || 12,
  demoFile: path.join(root, 'data', 'demo-sets.json'),
});

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const publicDir = path.join(root, 'public');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/retiring') {
      const data = await getData();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=300' });
      return res.end(JSON.stringify(data));
    }
    const file = path.join(publicDir, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(publicDir)) throw Object.assign(new Error(), { code: 'ENOENT' });
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    const missing = err.code === 'ENOENT' || err.code === 'EISDIR';
    if (!missing) console.error(err);
    res.writeHead(missing ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(missing ? 'Hittades inte' : 'Serverfel');
  }
});

const port = Number(env.PORT) || 3000;
server.listen(port, () => {
  console.log(`LEGO Utgår snart körs på http://localhost:${port}`);
  if (!env.BRICKSET_API_KEY) console.log('Tips: sätt BRICKSET_API_KEY i .env för riktig data (gratis på brickset.com).');
});
