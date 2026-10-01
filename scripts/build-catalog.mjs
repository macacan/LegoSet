// Bygger en kompakt katalog över alla LEGO-set (feed/catalog.json) så att man
// kan söka på vilket setnummer som helst och lägga till det i sin samling.
// Källa: Rebrickables gratis databasfiler (uppdateras dagligen, ingen nyckel).
// Körs av GitHub Actions – appen hämtar bara den färdiga filen via CDN.

import { gunzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://cdn.rebrickable.com/media/downloads';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'feed');

// Enkel CSV-läsare som klarar citattecken och kommatecken i namn.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.length > 1 || r[0]);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// Kompakt format: themes = ["Star Wars", ...], sets = [[nummer, namn, år, temaindex, bitar], ...]
export function buildCatalog(setsCsv, themesCsv) {
  const themes = new Map(parseCsv(themesCsv).map((t) => [t.id, t]));
  const rootName = (id) => {
    let t = themes.get(id);
    for (let guard = 0; t?.parent_id && themes.has(t.parent_id) && guard < 10; guard++) t = themes.get(t.parent_id);
    return t?.name || 'Övrigt';
  };

  const names = [];
  const index = new Map();
  const themeIndex = (name) => {
    if (!index.has(name)) {
      index.set(name, names.length);
      names.push(name);
    }
    return index.get(name);
  };

  const sets = parseCsv(setsCsv)
    // Riktiga set har nummer som "10305-1" och minst en bit (skippar böcker, kläder m.m.).
    .filter((s) => /^\d{3,7}-\d+$/.test(s.set_num) && Number(s.num_parts) > 0)
    .map((s) => [s.set_num, s.name, Number(s.year), rootName(s.theme_id), Number(s.num_parts)])
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], 'en', { numeric: true }))
    .map(([num, name, year, theme, parts]) => [num, name, year, themeIndex(theme), parts]);

  return { version: 1, source: 'rebrickable', updatedAt: new Date().toISOString(), themes: names, sets };
}

async function download(file) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Rebrickable ${file}: ${res.status}`);
  return gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
}

async function main() {
  try {
    const [setsCsv, themesCsv] = await Promise.all([download('sets.csv.gz'), download('themes.csv.gz')]);
    const catalog = buildCatalog(setsCsv, themesCsv);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'catalog.json'), JSON.stringify(catalog));
    console.log(`Skrev feed/catalog.json (${catalog.sets.length} set, ${catalog.themes.length} teman).`);
  } catch (err) {
    // Behåll förra katalogen om nedladdningen misslyckas.
    try {
      await readFile(path.join(outDir, 'catalog.json'));
      console.warn(`${err.message} – behåller förra katalogen.`);
    } catch {
      throw err;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
