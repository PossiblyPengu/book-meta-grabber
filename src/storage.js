/**
 * src/storage.js
 * Thin wrapper around @capacitor/preferences for library persistence.
 * Falls back to localStorage when running in browser dev mode.
 */

let Preferences;
try {
  ({ Preferences } = await import('@capacitor/preferences'));
} catch {
  Preferences = {
    get: async ({ key }) => ({ value: localStorage.getItem(key) }),
    set: async ({ key, value }) => localStorage.setItem(key, value),
    remove: async ({ key }) => localStorage.removeItem(key),
    keys: async () => ({ keys: Object.keys(localStorage) }),
  };
}

const LIB_KEY = 'library_v2';
const SETTINGS_KEY = 'app_settings';

export async function loadLibrary() {
  try {
    const { value } = await Preferences.get({ key: LIB_KEY });
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export async function saveLibrary(items) {
  // Don't persist cover blobs — too large; keep file refs + metadata only
  const slim = items.map((item) => ({
    ...item,
    coverBase64: null, // re-extracted on open
    coverMime: null,
  }));
  await Preferences.set({ key: LIB_KEY, value: JSON.stringify(slim) });
}

export async function loadSettings() {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    return value ? JSON.parse(value) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settings) {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
}

function defaultSettings() {
  return {
    googleDriveClientId: '',
    autoFetch: true,
    groupMultiImport: false,
    preferredSources: [
      'Google Books',
      'Open Library',
      'iTunes / Audible',
      'MusicBrainz',
    ],
    lastTab: 'library',
  };
}
