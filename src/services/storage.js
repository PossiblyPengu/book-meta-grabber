/**
 * Persistence: localStorage for metadata/settings, IndexedDB for cover art.
 */

const BOOKS_KEY = 'bmg_books_v2';
const SHELVES_KEY = 'bmg_shelves_v1';
const SETTINGS_KEY = 'bmg_settings_v1';
const DB_NAME = 'bmg_covers';
const DB_VERSION = 1;
const STORE_NAME = 'covers';

// ── localStorage helpers ─────────────────────────────────────────────────────

function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

// ── IndexedDB for covers ─────────────────────────────────────────────────────

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveCover(bookId, base64, mime) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ base64, mime }, bookId);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (e) {
    console.warn('IndexedDB cover save failed:', e);
  }
}

export async function getCover(bookId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(bookId);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteCover(bookId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(bookId);
  } catch {}
}

export async function getAllCovers() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    const reqValues = store.getAll();
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        const keys = req.result || [];
        const values = reqValues.result || [];
        const map = {};
        keys.forEach((k, i) => {
          map[k] = values[i];
        });
        resolve(map);
      };
      tx.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

// ── Books ────────────────────────────────────────────────────────────────────

export function loadBooks() {
  return getJSON(BOOKS_KEY, []);
}

export function saveBooks(books) {
  // Strip cover data from localStorage (stored in IndexedDB)
  const stripped = books.map(({ coverBase64, coverMime, ...rest }) => rest);
  setJSON(BOOKS_KEY, stripped);
}

// ── Shelves ──────────────────────────────────────────────────────────────────

const DEFAULT_SHELVES = [
  { id: 'shelf-all', name: 'All Books', isSystem: true, bookIds: [], color: '#6b7280' },
  { id: 'shelf-to-read', name: 'To Read', isSystem: true, bookIds: [], color: '#3b82f6' },
  { id: 'shelf-reading', name: 'Reading', isSystem: true, bookIds: [], color: '#f59e0b' },
  { id: 'shelf-finished', name: 'Finished', isSystem: true, bookIds: [], color: '#10b981' },
];

export function loadShelves() {
  const saved = getJSON(SHELVES_KEY, null);
  if (!saved) return [...DEFAULT_SHELVES];
  // Ensure system shelves always exist
  const ids = new Set(saved.map((s) => s.id));
  const merged = [...saved];
  for (const ds of DEFAULT_SHELVES) {
    if (!ids.has(ds.id)) merged.unshift(ds);
  }
  return merged;
}

export function saveShelves(shelves) {
  setJSON(SHELVES_KEY, shelves);
}

// ── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  theme: 'dark',
  gridSize: 'medium',
  viewMode: 'grid',
  sortBy: 'addedAt',
  sortOrder: 'desc',
  exportFormat: 'json',
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...getJSON(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  setJSON(SETTINGS_KEY, settings);
}
