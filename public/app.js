import { loadData, lastChecked } from './js/source.js';
import { loadProfile, saveProfile, resetProfile, AVATAR_COLORS } from './js/profile.js';
import { CURRENCIES, priceIn } from './js/money.js';

const $ = (s) => document.querySelector(s);
const DAY = 86400000;

const state = { sets: [], fx: null, data: null, q: '', theme: '', sort: 'exit', range: 'all', profile: loadProfile() };
const isSaved = (s) => state.profile.saved.includes(s.id);
const price = (s) => priceIn(s.prices, state.profile.currency, state.fx);

function updateProfile(change) {
  Object.assign(state.profile, change);
  saveProfile(state.profile);
  renderAvatar();
  render();
}

const today = () => new Date(new Date().toDateString()).getTime();
const daysLeft = (s) => Math.round((new Date(s.exitDate).getTime() - today()) / DAY);

const fmtDate = (iso, approx) =>
  approx
    ? `ca ${new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}`
    : new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

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
    lego: `https://www.lego.com/sv-se/search?q=${encodeURIComponent(s.number)}`,
    tradera: `https://www.tradera.com/search?q=${q}`,
    blocket: `https://www.blocket.se/annonser/hela_sverige?q=${q}`,
    bricklink: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(s.fullNumber)}#T=P`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  };
}

// Varje tema får en egen klossfärg (samma tema = samma färg).
const BRICK_COLORS = ['#d01012', '#f2cd37', '#0055bf', '#237841', '#fe8a18', '#a0bcac', '#923978', '#5a93db', '#bb805a'];
const LIGHT_COLORS = new Set(['#f2cd37', '#fe8a18', '#a0bcac', '#5a93db', '#bb805a']);
function themeColor(theme) {
  let h = 0;
  for (const ch of theme) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BRICK_COLORS[h % BRICK_COLORS.length];
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const list = state.sets.filter((s) => {
    if (state.theme && s.theme !== state.theme) return false;
    if (state.profile.onlyFav && state.profile.favThemes.length && !state.profile.favThemes.includes(s.theme)) return false;
    if (q && !`${s.name} ${s.number} ${s.theme} ${s.subtheme || ''}`.toLowerCase().includes(q)) return false;
    const d = daysLeft(s);
    switch (state.range) {
      case 'retired': return d < 0;
      case 'saved': return isSaved(s);
      case 'all': return true;
      default: return d >= 0 && d <= Number(state.range);
    }
  });
  const by = {
    exit: (a, b) => a.exitDate.localeCompare(b.exitDate),
    pieces: (a, b) => (b.pieces || 0) - (a.pieces || 0),
    name: (a, b) => a.name.localeCompare(b.name, 'sv'),
    year: (a, b) => b.year - a.year,
    price: (a, b) => (price(a)?.amount ?? Infinity) - (price(b)?.amount ?? Infinity),
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
      const on = isSaved(s);
      save.textContent = on ? '★' : '☆';
      save.classList.toggle('on', on);
      save.setAttribute('aria-pressed', on);
      save.onclick = () => {
        const saved = on ? state.profile.saved.filter((id) => id !== s.id) : [...state.profile.saved, s.id];
        updateProfile({ saved });
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
      ].filter(Boolean);
      el.querySelector('.facts').replaceChildren(...facts.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
      const p = price(s);
      const priceEl = el.querySelector('.price');
      priceEl.textContent = p ? p.text : '';
      priceEl.title = p && !p.exact ? 'Omräknat från europeiskt listpris med dagens växelkurs' : 'Listpris';

      const color = themeColor(s.theme);
      el.style.setProperty('--c', color);
      el.style.setProperty('--ct', LIGHT_COLORS.has(color) ? '#1b1a17' : '#fff');
      el.querySelector('.official-btn').textContent = daysLeft(s) >= 0 ? 'Köp nytt på LEGO.com' : 'Se på LEGO.com';

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
  document.querySelectorAll('.chip[data-range]').forEach((c) =>
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-range]').forEach((x) => x.classList.toggle('active', x === c));
      state.range = c.dataset.range;
      render();
    }),
  );
  $('#fav-chip').addEventListener('click', () => {
    if (!state.profile.favThemes.length) return openProfile();
    updateProfile({ onlyFav: !state.profile.onlyFav });
  });
}

function showData(data) {
  state.data = data;
  state.sets = data.sets || [];
  state.fx = data.currency || null;

  const themes = allThemes();
  if (!themes.includes(state.theme)) state.theme = '';
  $('#theme').replaceChildren(new Option('Alla teman', ''), ...themes.map((t) => new Option(t, t)));
  $('#theme').value = state.theme;

  const upcoming = state.sets.filter((s) => daysLeft(s) >= 0).length;
  const when = new Date(data.updatedAt).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
  const status = $('#status');
  status.textContent = `${upcoming} set på väg ut · data från ${when}`;
  status.classList.toggle('warn', data.source === 'demo' || Boolean(data.note));
  if (data.note) status.textContent += ` — ${data.note}`;
  render();
}

const allThemes = () => [...new Set(state.sets.map((s) => s.theme))].sort((a, b) => a.localeCompare(b, 'sv'));

async function load(opts) {
  const status = $('#status');
  status.classList.remove('warn');
  status.textContent = 'Laddar…';
  try {
    showData(await loadData(opts));
  } catch (err) {
    status.textContent = `Kunde inte ladda data (${err.message}).`;
    status.classList.add('warn');
  }
}

// ---------- Profil (lokal, ingen inloggning) ----------

function renderAvatar() {
  const p = state.profile;
  const btn = $('#open-profile');
  btn.style.background = p.color;
  btn.style.color = ['#f2cd37', '#fe8a18'].includes(p.color) ? '#1b1a17' : '#fff';
  btn.textContent = p.name ? p.name.trim()[0].toUpperCase() : '👤';
  $('#hello').textContent = p.name ? `Hej ${p.name.trim()}!` : '';

  const fav = $('#fav-chip');
  fav.classList.toggle('active', p.onlyFav && p.favThemes.length > 0);
  fav.textContent = p.favThemes.length ? `♥ Mina teman (${p.favThemes.length})` : '♥ Välj teman';
}

function openProfile() {
  const p = state.profile;
  const dlg = $('#profile');
  $('#p-name').value = p.name;
  $('#p-currency').replaceChildren(...CURRENCIES.map((c) => new Option(c.label, c.code, false, c.code === p.currency)));

  const colors = $('#p-colors');
  colors.replaceChildren(
    ...AVATAR_COLORS.map((c) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'swatch' });
      b.style.background = c;
      b.setAttribute('aria-label', `Färg ${c}`);
      b.setAttribute('aria-pressed', c === p.color);
      b.onclick = () => {
        colors.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-pressed', x === b));
        b.dataset.pick = c;
        colors.dataset.color = c;
      };
      return b;
    }),
  );
  colors.dataset.color = p.color;

  $('#p-themes').replaceChildren(
    ...allThemes().map((t) => {
      const label = document.createElement('label');
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', value: t, checked: p.favThemes.includes(t) });
      label.append(box, ` ${t}`);
      return label;
    }),
  );

  const checked = lastChecked();
  const fx = state.fx?.date ? ` · växelkurser ${state.fx.date}` : '';
  $('#p-stats').textContent =
    `${p.saved.length} sparade set · ${p.favThemes.length} favoritteman` +
    (state.data ? ` · data från ${new Date(state.data.updatedAt).toLocaleDateString('sv-SE')}${fx}` : '') +
    (checked ? ` · kollad ${checked.toLocaleTimeString('sv-SE', { timeStyle: 'short' })}` : '');
  dlg.showModal();
}

function bindProfile() {
  const dlg = $('#profile');
  $('#open-profile').onclick = openProfile;
  $('#p-close').onclick = () => dlg.close();
  $('#p-save').onclick = (e) => {
    e.preventDefault();
    const favThemes = [...$('#p-themes').querySelectorAll('input:checked')].map((i) => i.value);
    updateProfile({
      name: $('#p-name').value.trim().slice(0, 30),
      color: $('#p-colors').dataset.color,
      currency: $('#p-currency').value,
      favThemes,
      onlyFav: favThemes.length ? state.profile.onlyFav || !state.profile.favThemes.length : false,
    });
    dlg.close();
  };
  $('#p-refresh').onclick = (e) => {
    e.preventDefault();
    dlg.close();
    load({ force: true });
  };
  $('#p-reset').onclick = (e) => {
    e.preventDefault();
    if (!confirm('Rensa profil, sparade set och favoritteman?')) return;
    state.profile = resetProfile();
    renderAvatar();
    render();
    dlg.close();
  };
}

function init() {
  bind();
  bindProfile();
  renderAvatar();
  load();
}

init();
