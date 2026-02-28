import { getState, setState } from './store.js';
import { generateId } from '../utils/id.js';
import { saveBooks, saveShelves, saveSettings } from '../services/storage.js';
import { debounce } from '../utils/debounce.js';

const debouncedSaveBooks = debounce(() => saveBooks(getState().books), 500);
const debouncedSaveShelves = debounce(
  () => saveShelves(getState().shelves),
  500
);
const debouncedSaveSettings = debounce(
  () => saveSettings(getState().settings),
  500
);

// ── Books ────────────────────────────────────────────────────────────────────

export function addBooks(bookDataArray) {
  const { books } = getState();
  const newBooks = bookDataArray.map((data) => ({
    id: generateId(),
    addedAt: new Date().toISOString(),
    status: 'unread',
    progress: 0,
    favorite: false,
    currentPage: '',
    startDate: '',
    finishDate: '',
    notes: '',
    ...data,
  }));
  setState({ books: [...books, ...newBooks] });
  debouncedSaveBooks();
  return newBooks;
}

export function updateBook(id, updates) {
  const { books } = getState();
  setState({
    books: books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
  });
  debouncedSaveBooks();
}

export function removeBooks(ids) {
  const idSet = new Set(ids);
  const { books, shelves } = getState();
  setState({
    books: books.filter((b) => !idSet.has(b.id)),
    shelves: shelves.map((s) =>
      s.isSystem
        ? s
        : { ...s, bookIds: s.bookIds.filter((bid) => !idSet.has(bid)) }
    ),
  });
  debouncedSaveBooks();
  debouncedSaveShelves();
}

export function toggleFavorite(id) {
  const { books } = getState();
  const book = books.find((b) => b.id === id);
  if (book) updateBook(id, { favorite: !book.favorite });
}

// ── Shelves ──────────────────────────────────────────────────────────────────

export function createShelf(name, color = '#3b82f6') {
  const { shelves } = getState();
  const shelf = {
    id: generateId(),
    name,
    color,
    bookIds: [],
    isSystem: false,
    createdAt: new Date().toISOString(),
  };
  setState({ shelves: [...shelves, shelf] });
  debouncedSaveShelves();
  return shelf;
}

export function renameShelf(id, name) {
  const { shelves } = getState();
  setState({
    shelves: shelves.map((s) => (s.id === id ? { ...s, name } : s)),
  });
  debouncedSaveShelves();
}

export function deleteShelf(id) {
  const { shelves } = getState();
  setState({ shelves: shelves.filter((s) => s.id !== id || s.isSystem) });
  debouncedSaveShelves();
}

export function addBooksToShelf(shelfId, bookIds) {
  const { shelves } = getState();
  setState({
    shelves: shelves.map((s) => {
      if (s.id !== shelfId || s.isSystem) return s;
      const existing = new Set(s.bookIds);
      bookIds.forEach((bid) => existing.add(bid));
      return { ...s, bookIds: [...existing] };
    }),
  });
  debouncedSaveShelves();
}

export function removeBooksFromShelf(shelfId, bookIds) {
  const { shelves } = getState();
  const removeSet = new Set(bookIds);
  setState({
    shelves: shelves.map((s) => {
      if (s.id !== shelfId || s.isSystem) return s;
      return { ...s, bookIds: s.bookIds.filter((bid) => !removeSet.has(bid)) };
    }),
  });
  debouncedSaveShelves();
}

// ── Filters & View ───────────────────────────────────────────────────────────

export function setView(view) {
  const { filters } = getState();
  setState({ activeView: view, filters: { ...filters, format: 'all' } });
}

export function setActiveShelf(shelfId) {
  setState({
    activeShelfId: shelfId,
    activeView: shelfId ? 'shelf' : 'library',
  });
}

export function setFilter(format) {
  const { filters } = getState();
  setState({ filters: { ...filters, format } });
}

export function setSearchQuery(query) {
  const { filters } = getState();
  setState({ filters: { ...filters, query } });
}

export function setSort(by, order) {
  setState({ sort: { by, order } });
  debouncedSaveSettings();
}

// ── UI State ─────────────────────────────────────────────────────────────────

export function openEditor(bookId) {
  setState({ ui: { ...getState().ui, editorBookId: bookId } });
}

export function closeEditor() {
  setState({ ui: { ...getState().ui, editorBookId: null } });
}

export function toggleSelectMode() {
  const { ui } = getState();
  setState({
    ui: {
      ...ui,
      selectMode: !ui.selectMode,
      selectedBookIds: new Set(),
    },
  });
}

export function toggleBookSelection(bookId) {
  const { ui } = getState();
  const selected = new Set(ui.selectedBookIds);
  if (selected.has(bookId)) selected.delete(bookId);
  else selected.add(bookId);
  setState({ ui: { ...ui, selectedBookIds: selected } });
}

export function selectAllBooks(bookIds) {
  const { ui } = getState();
  setState({ ui: { ...ui, selectedBookIds: new Set(bookIds) } });
}

export function clearSelection() {
  const { ui } = getState();
  setState({ ui: { ...ui, selectedBookIds: new Set(), selectMode: false } });
}

export function openCommandPalette() {
  setState({ ui: { ...getState().ui, commandPaletteOpen: true } });
}

export function closeCommandPalette() {
  setState({ ui: { ...getState().ui, commandPaletteOpen: false } });
}

export function setBulkEnrichment(progress) {
  setState({ ui: { ...getState().ui, bulkEnrichment: progress } });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function updateSettings(updates) {
  const { settings } = getState();
  const next = { ...settings, ...updates };
  setState({ settings: next });
  debouncedSaveSettings();
}

export function toggleTheme() {
  const { settings } = getState();
  updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
}
