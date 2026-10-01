import { loadData } from './js/source.js';
import { loadProfile, saveProfile, resetProfile, AVATAR_COLORS } from './js/profile.js';
import { CURRENCIES, priceIn } from './js/money.js';

const $ = (s) => document.querySelector(s);
const DAY = 86400000;
const FAV = '__fav';

const state = {
  sets: [],
  fx: null,
  tab: 'home',
  q: '',
  theme: '',
  range: 'all',
  sort: 'exit',
  profile: loadProfile(),
};

// ---------- Hjälpare ----------

const today = () => new Date(new Date().toDateString()).getTime();
const daysLeft = (s) => Math.round((new Date(s.exitDate).getTime() - today()) / DAY);
const isSaved = (s) => state.profile.saved.includes(s.id);
const price = (s) => priceIn(s.prices, state.profile.currency, state.fx);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

function exitText(s) {
  const d = new Date(s.exitDate);
  if (s.approximate) return d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function badge(s) {
  const d = daysLeft(s);
  if (d < 0) return { text: 'Slutsåld i butik', cls: 'gone' };
  if (s.approximate) {
    const when = new Date(s.exitDate).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' });
    return { text: `Ca ${when}`, cls: 'later' };
  }
  if (d === 0) return { text: 'Sista dagen!', cls: 'urgent' };
  if (d <= 60) return { text: `${d} dagar kvar`, cls: 'urgent' };
  const months = Math.round(d / 30);
  return { text: `${months} mån kvar`, cls: d <= 180 ? 'soon' : 'later' };
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
const textOn = (color) => (LIGHT_COLORS.has(color) ? '#1b1a17' : '#fff');

const allThemes = () => [...new Set(state.sets.map((s) => s.theme))].sort((a, b) => a.localeCompare(b, 'sv'));

// ---------- Flikar ----------

const TABS = {
  home: { hash: '', title: 'Utgår snart' },
  retired: { hash: '#begagnat', title: 'Köp begagnat' },
  saved: { hash: '#sparade', title: 'Mina sparade set' },
  profile: { hash: '#profil', title: 'Profil' },
};

function tabFromHash() {
  const h = location.hash;
  return Object.keys(TABS).find((k) => TABS[k].hash === h) || 'home';
}

function showTab() {
  state.tab = tabFromHash();
  const isProfile = state.tab === 'profile';
  $('#list-view').hidden = isProfile;
  $('#profile-view').hidden = !isProfile;
  $('#hero').hidden = state.tab !== 'home';
  $('#time-chips').hidden = state.tab !== 'home';
  $('#list-title').textContent = TABS[state.tab].title;
  $('#sort option[value=exit]').textContent = state.tab === 'retired' ? 'Senast slutsålda' : 'Snart borta först';
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === state.tab));
  if (isProfile) renderProfile();
  else render();
  window.scrollTo({ top: 0 });
}

// ---------- Lista ----------

function filtered() {
  const q = state.q.trim().toLowerCase();
  const fav = state.profile.favThemes;
  const list = state.sets.filter((s) => {
    const d = daysLeft(s);
    if (state.tab === 'home' && d < 0) return false;
    if (state.tab === 'retired' && d >= 0) return false;
    if (state.tab === 'saved' && !isSaved(s)) return false;
    if (state.tab === 'home' && state.range !== 'all' && d > Number(state.range)) return false;
    if (state.theme === FAV ? !fav.includes(s.theme) : state.theme && s.theme !== state.theme) return false;
    if (q && !`${s.name} ${s.number} ${s.theme} ${s.subtheme || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const by = {
    exit: (a, b) => (state.tab === 'retired' ? b.exitDate.localeCompare(a.exitDate) : a.exitDate.localeCompare(b.exitDate)),
    pieces: (a, b) => (b.pieces || 0) - (a.pieces || 0),
    name: (a, b) => a.name.localeCompare(b.name, 'sv'),
    price: (a, b) => (price(a)?.amount ?? Infinity) - (price(b)?.amount ?? Infinity),
  }[state.sort];
  return list.sort(by);
}

function renderThemeChips() {
  const fav = state.profile.favThemes;
  const themes = allThemes();
  if (state.theme && state.theme !== FAV && !themes.includes(state.theme)) state.theme = '';
  if (state.theme === FAV && !fav.length) state.theme = '';

  const chip = (value, label) => {
    const b = el('button', { type: 'button', className: 'chip', textContent: label });
    b.classList.toggle('active', state.theme === value);
    if (value === FAV) b.classList.add('fav');
    b.onclick = () => {
      state.theme = state.theme === value ? '' : value;
      renderThemeChips();
      render();
    };
    return b;
  };
  $('#theme-chips').replaceChildren(
    chip('', 'Alla teman'),
    ...(fav.length ? [chip(FAV, '♥ Mina teman')] : []),
    ...themes.map((t) => chip(t, t)),
  );
}

function card(s) {
  const node = $('#card').content.firstElementChild.cloneNode(true);
  const color = themeColor(s.theme);
  node.style.setProperty('--c', color);
  node.style.setProperty('--ct', textOn(color));

  const img = node.querySelector('img');
  img.src = s.image || s.thumbnail || '';
  img.alt = s.name;
  img.onerror = () => img.replaceWith(el('div', { className: 'noimg', textContent: '🧱' }));

  const b = badge(s);
  const bEl = node.querySelector('.badge');
  bEl.textContent = b.text;
  bEl.classList.add(b.cls);

  const save = node.querySelector('.save');
  const on = isSaved(s);
  save.textContent = on ? '★' : '☆';
  save.classList.toggle('on', on);
  save.setAttribute('aria-pressed', on);
  save.setAttribute('aria-label', on ? 'Ta bort från sparade' : 'Spara');
  save.onclick = () => {
    const saved = on ? state.profile.saved.filter((id) => id !== s.id) : [...state.profile.saved, s.id];
    updateProfile({ saved });
    render();
  };

  node.querySelector('.num').textContent = s.number;
  node.querySelector('.theme').textContent = s.theme;
  node.querySelector('.name').textContent = s.name;

  const gone = daysLeft(s) < 0;
  node.querySelector('.sub').textContent = [
    s.pieces && `${s.pieces.toLocaleString('sv-SE')} bitar`,
    gone ? `Slutade säljas ${exitText(s)}` : `Försvinner ${s.approximate ? 'ca ' : ''}${exitText(s)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const p = price(s);
  node.querySelector('.price').textContent = p ? (gone ? `Nypris var ${p.text}` : p.text) : '';

  const links = shopLinks(s);
  const primary = node.querySelector('.btn.primary');
  const secondary = node.querySelector('.btn.ghost');
  if (gone) {
    // Slutsålda: begagnat är huvudvalet.
    primary.replaceWith(el('button', { type: 'button', className: 'btn primary', textContent: 'Hitta begagnat', onclick: () => openUsed(s) }));
    secondary.replaceWith(el('a', { className: 'btn ghost', href: links.lego, target: '_blank', rel: 'noopener', textContent: 'LEGO.com' }));
  } else {
    primary.href = links.lego;
    primary.textContent = 'Köp nytt';
    secondary.textContent = 'Begagnat';
    secondary.onclick = () => openUsed(s);
  }
  return node;
}

const EMPTY = {
  filtered: 'Inga set matchar. Testa att ta bort ett filter eller sök på något annat.',
  home: 'Inga set på väg ut just nu – titta in snart igen!',
  retired: 'Inga nyligen slutsålda set just nu.',
  saved: 'Du har inte sparat något än. Tryck på ☆ på ett set så hamnar det här.',
};

function render() {
  const count = state.profile.saved.length;
  $('#saved-count').hidden = !count;
  $('#saved-count').textContent = count;
  if (state.tab === 'profile') return;

  const list = filtered();
  $('#grid').replaceChildren(...list.map(card));
  $('#empty').hidden = list.length > 0 || !state.sets.length;
  const narrowed = state.q || state.theme || (state.tab === 'home' && state.range !== 'all');
  $('#empty-text').textContent = narrowed && state.tab !== 'saved' ? EMPTY.filtered : EMPTY[state.tab];
}

// ---------- Begagnat-ark ----------

function openUsed(s) {
  const links = shopLinks(s);
  $('#used-name').textContent = `${s.name} (${s.number})`;
  document.querySelectorAll('#used [data-shop]').forEach((a) => (a.href = links[a.dataset.shop]));
  $('#used').showModal();
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
  const name = state.profile.name.trim();
  $('#hello').textContent = name ? `Hej ${name}! 👋` : '';
  $('#hello').hidden = !name;
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
        renderThemeChips();
        renderProfile();
      };
      return b;
    }),
  );
}

function bindProfile() {
  $('#p-name').addEventListener('input', (e) => updateProfile({ name: e.target.value.slice(0, 30) }));
  $('#p-reset').onclick = () => {
    if (!confirm('Vill du rensa namn, sparade set och favoritteman?')) return;
    state.profile = resetProfile();
    saveProfile(state.profile);
    renderAvatar();
    renderThemeChips();
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
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });
  document.querySelectorAll('#time-chips .chip').forEach((c) =>
    c.addEventListener('click', () => {
      document.querySelectorAll('#time-chips .chip').forEach((x) => x.classList.toggle('active', x === c));
      state.range = c.dataset.range;
      render();
    }),
  );
  window.addEventListener('hashchange', showTab);
}

async function load() {
  $('#grid').replaceChildren(...Array.from({ length: 4 }, () => el('div', { className: 'card skeleton' })));
  const data = await loadData();
  state.sets = data.sets || [];
  state.fx = data.currency || null;
  const notice = $('#notice');
  notice.hidden = !data.offline;
  notice.textContent = state.sets.length
    ? 'Du verkar vara offline – vi visar listan från senast.'
    : 'Kunde inte hämta listan. Kolla att du är uppkopplad och öppna appen igen.';
  renderThemeChips();
  showTab();
}

bind();
bindProfile();
renderAvatar();
load();
