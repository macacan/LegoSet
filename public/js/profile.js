// Lokal profil – sparas bara i telefonen/webbläsaren. Inget konto, ingen inloggning.

const KEY = 'legoset:profile';
const OLD_SAVED_KEY = 'legoset:saved';

export const AVATAR_COLORS = ['#d01012', '#0055bf', '#237841', '#f2cd37', '#fe8a18', '#923978', '#1b1a17'];

const defaults = () => ({ name: '', color: AVATAR_COLORS[1], currency: 'SEK', favThemes: [], saved: [], onlyFav: false });

export function loadProfile() {
  let p = {};
  try {
    p = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {}
  const profile = { ...defaults(), ...p };
  // Flytta över sparade set från den första versionen av appen.
  try {
    const old = JSON.parse(localStorage.getItem(OLD_SAVED_KEY));
    if (Array.isArray(old) && old.length) {
      profile.saved = [...new Set([...profile.saved, ...old])];
      localStorage.removeItem(OLD_SAVED_KEY);
      saveProfile(profile);
    }
  } catch {}
  return profile;
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {}
}

export function resetProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  return defaults();
}
