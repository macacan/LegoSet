import { loadData, isApp, getApiKey, setApiKey } from './js/source.js';

const $ = (s) => document.querySelector(s);
const DAY = 86400000;
const SAVED_KEY = 'legoset:saved';

const state = { sets: [], q: '', theme: '', sort: 'exit', range: 'all', saved: loadSaved() };

function loadSaved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY)) || []);
  } catch {
    return new Set();
  }
}
function storeSaved() {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
  } catch {}
}

const today = () => new Date(new Date().toDateString()).getTime();
const daysLeft = (s) => Math.round((new Date(s.exitDate).getTime() - today()) / DAY);

const fmtDate = (iso, approx) =>
  approx
    ? `ca ${new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}`
    : new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

function price(p) {
  if (p.DE) return `${p.DE.toFixed(2).replace('.', ',')} €`;
  if (p.UK) return `£${p.UK.toFixed(2)}`;
  if (p.US) return `$${p.US.toFixed(2)}`;
  return null;
}

function badge(s) {
  const d = daysLeft(s);
  if (d < 0) return { text: 'Utgått', cls: 'gone' };
  if (s.approximate) return { text: fmtDate(s.exitDate, true), cls: 'later' };
  if (d === 0) return { text: 'Sista dagen!', cls: 'urgent' };
  if (d <= 60) return { text: `${d} dagar kvar`, cls: 'urgent' };
  if (d <= 180) return { text: `${Math.round(d / 30)} mån kvar`, cls: 'soon' };
  return { text: `${Math.round(d / 30)} mån kvar`, cls: 'later' };
}

function shopLinks(s) {
  const q = encodeURIComponent(`lego ${s.number}`);
  return {
    tradera: `https://www.tradera.com/search?q=${q}`,
    blocket: `https://www.blocket.se/annonser/hela_sverige?q=${q}`,
    bricklink: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(s.fullNumber)}#T=P`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  };
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const list = state.sets.filter((s) => {
    if (state.theme && s.theme !== state.theme) return false;
    if (q && !`${s.name} ${s.number} ${s.theme} ${s.subtheme || ''}`.toLowerCase().includes(q)) return false;
    const d = daysLeft(s);
    switch (state.range) {
      case 'retired': return d < 0;
      case 'saved': return state.saved.has(s.id);
      case 'all': return true;
      default: return d >= 0 && d <= Number(state.range);
    }
  });
  const by = {
    exit: (a, b) => a.exitDate.localeCompare(b.exitDate),
    pieces: (a, b) => (b.pieces || 0) - (a.pieces || 0),
    name: (a, b) => a.name.localeCompare(b.name, 'sv'),
    year: (a, b) => b.year - a.year,
  }[state.sort];
  return list.sort(by);
}

function render() {
  const grid = $('#grid');
  const tpl = $('#card');
  const list = filtered();
  grid.replaceChildren(
    ...list.map((s) => {
      const el = tpl.content.firstElementChild.cloneNode(true);
      const img = el.querySelector('img');
      img.src = s.image || s.thumbnail || '';
      img.alt = s.name;
      img.onerror = () => img.replaceWith(Object.assign(document.createElement('div'), { className: 'noimg', textContent: '🧱' }));

      const b = badge(s);
      const bEl = el.querySelector('.badge');
      bEl.textContent = b.text;
      bEl.classList.add(b.cls);
      bEl.title = `Utgår ${fmtDate(s.exitDate, s.approximate)}`;

      const save = el.querySelector('.save');
      const on = state.saved.has(s.id);
      save.textContent = on ? '★' : '☆';
      save.classList.toggle('on', on);
      save.setAttribute('aria-pressed', on);
      save.onclick = () => {
        state.saved.has(s.id) ? state.saved.delete(s.id) : state.saved.add(s.id);
        storeSaved();
        render();
      };

      el.querySelector('.num').textContent = s.number;
      el.querySelector('.theme').textContent = s.subtheme ? `${s.theme} · ${s.subtheme}` : s.theme;
      const name = el.querySelector('.name');
      name.append(Object.assign(document.createElement('a'), { href: s.bricksetURL, target: '_blank', rel: 'noopener', textContent: s.name }));

      const facts = [
        `Utgår ${fmtDate(s.exitDate, s.approximate)}`,
        s.pieces && `${s.pieces.toLocaleString('sv-SE')} bitar`,
        s.minifigs && `${s.minifigs} figurer`,
        s.year && `Från ${s.year}`,
        price(s.prices || {}),
      ].filter(Boolean);
      el.querySelector('.facts').replaceChildren(...facts.map((t) => Object.assign(document.createElement('li'), { textContent: t })));

      const links = shopLinks(s);
      el.querySelectorAll('[data-shop]').forEach((a) => (a.href = links[a.dataset.shop]));
      return el;
    }),
  );
  $('#empty').hidden = list.length > 0;
}

function bind() {
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#theme').addEventListener('change', (e) => { state.theme = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  document.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c));
      state.range = c.dataset.range;
      render();
    }),
  );
}

function showData(data) {
  state.sets = data.sets || [];

  const themes = [...new Set(state.sets.map((s) => s.theme))].sort((a, b) => a.localeCompare(b, 'sv'));
  if (!themes.includes(state.theme)) state.theme = '';
  $('#theme').replaceChildren(new Option('Alla teman', ''), ...themes.map((t) => new Option(t, t)));
  $('#theme').value = state.theme;

  const upcoming = state.sets.filter((s) => daysLeft(s) >= 0).length;
  const when = new Date(data.updatedAt).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
  const status = $('#status');
  status.textContent = `${upcoming} set på väg ut · uppdaterad ${when}`;
  status.classList.toggle('warn', data.source === 'demo' || Boolean(data.note));
  if (data.note) status.textContent += ` — ${data.note}`;
  render();
}

async function load(opts) {
  const status = $('#status');
  status.classList.remove('warn');
  status.textContent = getApiKey() && isApp() ? 'Hämtar från Brickset… (kan ta några sekunder)' : 'Laddar…';
  try {
    showData(await loadData(opts));
  } catch (err) {
    status.textContent = `Kunde inte ladda data (${err.message}).`;
    status.classList.add('warn');
  }
}

function bindSettings() {
  const dlg = $('#settings');
  $('#open-settings').hidden = false;
  $('#open-settings').onclick = () => {
    $('#api-key').value = getApiKey();
    dlg.showModal();
  };
  $('#close-settings').onclick = () => dlg.close();
  $('#save-settings').onclick = (e) => {
    e.preventDefault();
    setApiKey($('#api-key').value.trim());
    dlg.close();
    load();
  };
  $('#refresh').onclick = (e) => {
    e.preventDefault();
    dlg.close();
    load({ force: true });
  };
}

function init() {
  bind();
  if (isApp()) bindSettings();
  load();
}

init();
