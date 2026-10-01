import { loadData, loadCatalog, searchCatalog } from './js/source.js';
import { loadProfile, saveProfile, resetProfile, AVATAR_COLORS } from './js/profile.js';
import { CURRENCIES, priceIn } from './js/money.js';

const $ = (s) => document.querySelector(s);
const DAY = 86400000;
const FAV = '__fav';

const state = {
  sets: [],
  byNum: new Map(),
  fx: null,
  tab: 'home',
  q: '',
  theme: '',
  range: 'all',
  sort: 'exit',
  profile: loadProfile(),
  catalog: null,
  catalogState: 'idle', // idle | loading | ready | failed
  detail: null,
};

// ---------- Hjälpare ----------

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const today = () => new Date(new Date().toDateString()).getTime();
const daysLeft = (s) => Math.round((new Date(s.exitDate).getTime() - today()) / DAY);
const price = (s) => priceIn(s?.prices, state.profile.currency, state.fx);

// Ett "item" är ett set oavsett källa (utgår-listan, katalogen eller samlingen).
function itemFrom(src) {
  const feed = src.exitDate ? src : state.byNum.get(src.num);
  const num = src.fullNumber || src.num;
  return {
    num,
    number: src.number || num.replace(/-1$/, ''),
    name: src.name,
    theme: src.theme || 'Övrigt',
    year: src.year,
    pieces: src.pieces,
    image: feed?.image || feed?.thumbnail || `https://images.brickset.com/sets/images/${num}.jpg`,
    feed,
  };
}

const isOwned = (it) => state.profile.collection.some((c) => c.num === it.num);
const isSaved = (it) => state.profile.saved.includes(it.num) || (it.feed && state.profile.saved.includes(it.feed.id));

function exitText(s) {
  const d = new Date(s.exitDate);
  return s.approximate
    ? d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function status(s) {
  if (!s) return null;
  const d = daysLeft(s);
  if (d < 0) return { text: 'Slutsåld i butik', cls: 'gone' };
  if (s.approximate) return { text: `Utgår ca ${exitText(s)}`, cls: 'later' };
  if (d === 0) return { text: 'Sista dagen!', cls: 'urgent' };
  if (d <= 60) return { text: `${d} dagar kvar`, cls: 'urgent' };
  return { text: `${Math.round(d / 30)} mån kvar`, cls: d <= 180 ? 'soon' : 'later' };
}

function shopLinks(it) {
  const q = encodeURIComponent(`lego ${it.number}`);
  return {
    lego: `https://www.lego.com/sv-se/search?q=${encodeURIComponent(it.number)}`,
    tradera: `https://www.tradera.com/search?q=${q}`,
    blocket: `https://www.blocket.se/annonser/hela_sverige?q=${q}`,
    bricklink: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(it.num)}#T=P`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  };
}

// Varje tema får en egen klossfärg.
const BRICK_COLORS = ['#d01012', '#f2cd37', '#0055bf', '#237841', '#fe8a18', '#a0bcac', '#923978', '#5a93db', '#bb805a'];
const LIGHT_COLORS = new Set(['#f2cd37', '#fe8a18', '#a0bcac', '#5a93db', '#bb805a']);
function themeColor(theme) {
  let h = 0;
  for (const ch of theme) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BRICK_COLORS[h % BRICK_COLORS.length];
}
const textOn = (c) => (LIGHT_COLORS.has(c) ? '#1b1a17' : '#fff');
const allThemes = () => [...new Set(state.sets.map((s) => s.theme))].sort((a, b) => a.localeCompare(b, 'sv'));

function setImage(img, it, wrap) {
  img.src = it.image;
  img.alt = '';
  img.onerror = () => img.replaceWith(el('span', { className: 'ph', textContent: '🧱' }));
  if (wrap) wrap.replaceChildren(img);
}

// ---------- Flikar ----------

const TABS = {
  home: { hash: '', title: 'Utgår snart', intro: 'LEGO®-set som snart slutar säljas. Tryck på ett set för att köpa nytt eller begagnat.' },
  retired: { hash: '#begagnat', title: 'Köp begagnat', intro: 'Set som nyss slutat säljas i butik – nu finns de bara begagnat.' },
  collection: { hash: '#samling', title: 'Min samling', intro: 'Set du äger. Sök på setnummer eller namn för att lägga till.' },
  saved: { hash: '#sparade', title: 'Sparade', intro: 'Set du bevakar.' },
  profile: { hash: '#profil', title: 'Profil' },
};

function showTab() {
  const tab = Object.keys(TABS).find((k) => TABS[k].hash === location.hash) || 'home';
  const changed = tab !== state.tab;
  state.tab = tab;
  const isProfile = tab === 'profile';
  $('#list-view').hidden = isProfile;
  $('#profile-view').hidden = !isProfile;
  $('#list-title').textContent = TABS[tab].title;
  $('#list-intro').textContent = TABS[tab].intro || '';
  $('#time').hidden = tab !== 'home';
  $('#theme').hidden = tab === 'collection';
  $('#sort').hidden = tab === 'collection';
  $('#q').placeholder = tab === 'collection' ? 'Sök set att lägga till' : 'Sök setnummer eller namn';
  $('#sort option[value=exit]').textContent = tab === 'retired' ? 'Senast slutsålda' : 'Snart borta';
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  if (tab === 'collection') ensureCatalog();
  if (isProfile) renderProfile();
  else render();
  if (changed) window.scrollTo(0, 0);
}

// ---------- Lista ----------

function row(it) {
  const li = el('li', { className: 'row' });
  const btn = el('button', { type: 'button', className: 'row-btn' });
  btn.onclick = () => openDetail(it);

  const thumb = el('span', { className: 'thumb' });
  thumb.style.setProperty('--c', themeColor(it.theme));
  setImage(el('img', { loading: 'lazy', decoding: 'async', width: 64, height: 64 }), it, thumb);

  const main = el('span', { className: 'row-main' });
  main.append(
    el('p', { className: 'row-name', textContent: it.name }),
    el('p', { className: 'row-sub', textContent: [it.number, it.theme, it.pieces && `${it.pieces.toLocaleString('sv-SE')} bitar`].filter(Boolean).join(' · ') }),
  );
  const st = status(it.feed);
  if (st) main.append(el('p', { className: `row-status ${st.cls}`, textContent: st.text }));

  const side = el('span', { className: 'row-side' });
  const p = price(it.feed);
  if (p) side.append(el('span', { className: 'row-price', textContent: p.text }));
  const marks = el('span', { className: 'row-marks' });
  if (isOwned(it)) marks.append(el('span', { className: 'own', textContent: '✓', title: 'I min samling' }));
  if (isSaved(it)) marks.append(el('span', { className: 'saved', textContent: '★', title: 'Sparad' }));
  if (marks.childNodes.length) side.append(marks);

  btn.append(thumb, main, side);
  li.append(btn);
  return li;
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const fav = state.profile.favThemes;
  const list = state.sets.filter((s) => {
    const d = daysLeft(s);
    if (state.tab === 'home' && (d < 0 || (state.range !== 'all' && d > Number(state.range)))) return false;
    if (state.tab === 'retired' && d >= 0) return false;
    if (state.tab === 'saved' && !isSaved(itemFrom(s))) return false;
    if (state.theme === FAV ? !fav.includes(s.theme) : state.theme && s.theme !== state.theme) return false;
    if (q && !`${s.name} ${s.number} ${s.fullNumber} ${s.theme}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const by = {
    exit: (a, b) => (state.tab === 'retired' ? b.exitDate.localeCompare(a.exitDate) : a.exitDate.localeCompare(b.exitDate)),
    pieces: (a, b) => (b.pieces || 0) - (a.pieces || 0),
    name: (a, b) => a.name.localeCompare(b.name, 'sv'),
    price: (a, b) => (price(a)?.amount ?? Infinity) - (price(b)?.amount ?? Infinity),
  }[state.sort];
  return list.sort(by).map(itemFrom);
}

function collectionItems() {
  const q = state.q.trim().toLowerCase();
  return state.profile.collection
    .filter((c) => !q || `${c.name} ${c.number} ${c.num} ${c.theme}`.toLowerCase().includes(q))
    .map(itemFrom);
}

const plural = (n, one, many) => `${n.toLocaleString('sv-SE')} ${n === 1 ? one : many}`;

function render() {
  const owned = state.profile.collection.length;
  $('#own-count').hidden = !owned;
  $('#own-count').textContent = owned;
  const saved = state.profile.saved.length;
  $('#saved-count').hidden = !saved;
  $('#saved-count').textContent = saved;
  if (state.tab === 'profile') return;

  const items = state.tab === 'collection' ? collectionItems() : filtered();
  $('#list').replaceChildren(...items.map(row));

  const searching = state.q.trim().length >= 2;
  let countText = '';
  if (state.tab === 'collection' && owned) {
    const pieces = state.profile.collection.reduce((n, c) => n + (c.pieces || 0), 0);
    countText = `${plural(owned, 'set', 'set')} · ${plural(pieces, 'bit', 'bitar')}`;
  } else if (state.tab !== 'collection' && items.length) {
    countText = plural(items.length, 'set', 'set');
  }
  $('#count').textContent = countText;

  const more = renderMore(new Set(items.map((i) => i.num)));
  const emptyText = {
    home: 'Inga set på väg ut just nu – titta in snart igen!',
    retired: 'Inga nyligen slutsålda set just nu.',
    saved: 'Inget sparat än. Tryck på ett set och välj ”☆ Spara”.',
    collection: 'Din samling är tom. Sök på ett setnummer, t.ex. 10305, och lägg till det.',
  }[state.tab];
  const narrowed = state.theme || (state.tab === 'home' && state.range !== 'all');
  $('#empty').hidden = items.length > 0 || more > 0 || searching || (!state.sets.length && state.tab !== 'collection');
  $('#empty-text').textContent = narrowed ? 'Inga set matchar filtret.' : emptyText;
}

// ---------- Sök bland alla set ----------

async function ensureCatalog() {
  if (state.catalogState === 'loading' || state.catalogState === 'ready') return;
  state.catalogState = 'loading';
  state.catalog = await loadCatalog();
  state.catalogState = state.catalog ? 'ready' : 'failed';
  render();
}

function renderMore(shown) {
  const q = state.q.trim();
  const box = $('#more');
  if (q.length < 2) {
    box.hidden = true;
    return 0;
  }
  if (state.catalogState === 'idle') ensureCatalog();
  const hits = searchCatalog(state.catalog, q, 40).filter((c) => !shown.has(c.num)).map(itemFrom);
  $('#more-list').replaceChildren(...hits.map(row));
  const msg =
    state.catalogState === 'loading' ? 'Söker bland alla LEGO-set…'
    : state.catalogState === 'failed' ? 'Kunde inte söka just nu. Kolla din uppkoppling.'
    : hits.length ? ''
    : /^\d+$/.test(q) && q.length < 3 ? 'Skriv minst tre siffror.'
    : shown.size ? ''
    : 'Hittade inget set som matchar.';
  $('#more-status').textContent = msg;
  $('#more-status').hidden = !msg;
  box.hidden = !hits.length && !msg;
  return hits.length;
}

// ---------- Detaljark ----------

function openDetail(it) {
  state.detail = it;
  paintDetail();
  const dlg = $('#detail');
  if (!dlg.open) {
    dlg.showModal();
    // Androids tillbaka-knapp stänger arket i stället för att byta flik.
    history.pushState({ sheet: true }, '');
  }
}

function closeDetail() {
  const dlg = $('#detail');
  if (dlg.open) dlg.close();
}

function paintDetail() {
  const it = state.detail;
  if (!it) return;
  const color = themeColor(it.theme);
  const dlg = $('#detail');
  dlg.style.setProperty('--c', color);
  $('#d-num').style.color = textOn(color);
  setImage(el('img', { decoding: 'async' }), it, $('.d-pic'));
  $('#d-num').textContent = it.number;
  $('#d-theme').textContent = it.theme;
  $('#d-name').textContent = it.name;

  const s = it.feed;
  const st = status(s);
  const gone = s && daysLeft(s) < 0;
  $('#d-status').className = `d-status ${st?.cls || ''}`;
  $('#d-status').textContent = !s ? '' : gone ? `Slutade säljas ${exitText(s)}` : `Slutar säljas ${s.approximate ? 'ca ' : ''}${exitText(s)}`;
  $('#d-facts').textContent = [it.pieces && `${it.pieces.toLocaleString('sv-SE')} bitar`, it.year && `Från ${it.year}`].filter(Boolean).join(' · ');
  const p = price(s);
  $('#d-price').textContent = p ? (gone ? `Nypris var ${p.text}` : p.text) : '';

  const links = shopLinks(it);
  $('#d-lego').href = links.lego;
  $('#d-lego').textContent = gone ? 'Se på LEGO.com' : 'Köp nytt på LEGO.com';
  document.querySelectorAll('#detail [data-shop]').forEach((a) => (a.href = links[a.dataset.shop]));

  const own = isOwned(it);
  $('#d-own').textContent = own ? '✓ I min samling' : '＋ Min samling';
  $('#d-own').setAttribute('aria-pressed', own);
  const save = $('#d-save');
  save.hidden = !s; // bara set på väg ut kan bevakas
  save.classList.add('star');
  save.textContent = isSaved(it) ? '★ Sparad' : '☆ Spara';
  save.setAttribute('aria-pressed', isSaved(it));
}

function bindDetail() {
  const dlg = $('#detail');
  $('#d-close').onclick = closeDetail;
  dlg.addEventListener('click', (e) => e.target === dlg && closeDetail()); // tryck utanför
  dlg.addEventListener('close', () => {
    state.detail = null;
    if (history.state?.sheet) history.back();
  });
  window.addEventListener('popstate', () => closeDetail());

  $('#d-own').onclick = () => {
    const it = state.detail;
    const collection = isOwned(it)
      ? state.profile.collection.filter((c) => c.num !== it.num)
      : [{ num: it.num, number: it.number, name: it.name, theme: it.theme, year: it.year, pieces: it.pieces, addedAt: new Date().toISOString() }, ...state.profile.collection];
    updateProfile({ collection });
    paintDetail();
    render();
  };
  $('#d-save').onclick = () => {
    const it = state.detail;
    const saved = isSaved(it)
      ? state.profile.saved.filter((k) => k !== it.num && k !== it.feed?.id)
      : [...state.profile.saved, it.num];
    updateProfile({ saved });
    paintDetail();
    render();
  };
}

// ---------- Profil (sparas bara i telefonen) ----------

function updateProfile(change) {
  Object.assign(state.profile, change);
  saveProfile(state.profile);
  renderAvatar();
}

function paintAvatar(node) {
  const p = state.profile;
  node.style.background = p.color;
  node.style.color = textOn(p.color);
  node.textContent = p.name.trim() ? p.name.trim()[0].toUpperCase() : '👤';
}

function renderAvatar() {
  paintAvatar($('#avatar'));
  paintAvatar($('#p-avatar'));
}

function renderThemeSelect() {
  const fav = state.profile.favThemes;
  const themes = allThemes();
  if (state.theme === FAV && !fav.length) state.theme = '';
  if (state.theme && state.theme !== FAV && !themes.includes(state.theme)) state.theme = '';
  $('#theme').replaceChildren(
    new Option('Alla teman', ''),
    ...(fav.length ? [new Option('♥ Mina teman', FAV)] : []),
    ...themes.map((t) => new Option(t, t)),
  );
  $('#theme').value = state.theme;
}

function renderProfile() {
  const p = state.profile;
  if (document.activeElement !== $('#p-name')) $('#p-name').value = p.name;

  $('#p-colors').replaceChildren(
    ...AVATAR_COLORS.map((c) => {
      const b = el('button', { type: 'button', className: 'swatch' });
      b.style.background = c;
      b.setAttribute('aria-label', 'Välj färg');
      b.setAttribute('aria-pressed', c === p.color);
      b.onclick = () => {
        updateProfile({ color: c });
        renderProfile();
      };
      return b;
    }),
  );

  $('#p-currency').replaceChildren(
    ...CURRENCIES.map((c) => {
      const b = el('button', { type: 'button', textContent: c.code, title: c.label });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', c.code === p.currency);
      b.onclick = () => {
        updateProfile({ currency: c.code });
        renderProfile();
      };
      return b;
    }),
  );
  $('#p-currency-note').textContent = ['SEK', 'NOK', 'DKK'].includes(p.currency)
    ? 'Priserna räknas om från LEGO:s europeiska pris och är ungefärliga (≈).'
    : 'Priserna är LEGO:s ordinarie pris.';

  const themes = allThemes();
  $('#p-themes').replaceChildren(
    ...(themes.length ? themes : p.favThemes).map((t) => {
      const on = p.favThemes.includes(t);
      const b = el('button', { type: 'button', className: 'tag', textContent: on ? `♥ ${t}` : t });
      b.setAttribute('aria-pressed', on);
      b.onclick = () => {
        updateProfile({ favThemes: on ? p.favThemes.filter((x) => x !== t) : [...p.favThemes, t] });
        renderThemeSelect();
        renderProfile();
      };
      return b;
    }),
  );
}

function bindProfile() {
  $('#p-name').addEventListener('input', (e) => updateProfile({ name: e.target.value.slice(0, 30) }));
  $('#p-reset').onclick = () => {
    if (!confirm('Vill du rensa namn, sparade set, favoritteman och din samling?')) return;
    state.profile = resetProfile();
    saveProfile(state.profile);
    renderAvatar();
    renderThemeSelect();
    renderProfile();
    render();
  };
}

// ---------- Start ----------

function bind() {
  $('#q').addEventListener('input', (e) => {
    state.q = e.target.value;
    render();
  });
  $('#q').addEventListener('keydown', (e) => e.key === 'Enter' && e.target.blur()); // stäng tangentbordet
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });
  $('#theme').addEventListener('change', (e) => {
    state.theme = e.target.value;
    render();
  });
  document.querySelectorAll('#time button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#time button').forEach((x) => x.setAttribute('aria-checked', x === b));
      state.range = b.dataset.range;
      render();
    }),
  );
  window.addEventListener('hashchange', showTab);
}

async function load() {
  $('#count').textContent = 'Laddar…';
  const data = await loadData();
  state.sets = data.sets || [];
  state.byNum = new Map(state.sets.map((s) => [s.fullNumber, s]));
  state.fx = data.currency || null;
  $('#notice').hidden = !data.offline;
  $('#notice').textContent = state.sets.length
    ? 'Du verkar vara offline – vi visar listan från senast.'
    : 'Kunde inte hämta listan. Kolla att du är uppkopplad och öppna appen igen.';
  renderThemeSelect();
  if (state.tab === 'profile') renderProfile();
  render(); // ingen scroll till toppen – användaren kan redan ha börjat scrolla
}

bind();
bindProfile();
bindDetail();
renderAvatar();
showTab();
load();
