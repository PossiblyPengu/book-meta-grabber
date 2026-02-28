/**
 * Book Meta Grabber v2.0
 * Entry point: initializes state, mounts UI, handles all events via delegation.
 */

import './styles/variables.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';

import { initState, getState, setState, subscribe } from './state/store.js';
import {
  addBooks,
  updateBook,
  removeBooks,
  createShelf,
  addBooksToShelf,
  removeBooksFromShelf,
  setView,
  setActiveShelf,
  setFilter,
  setSearchQuery,
  setSort,
  openEditor,
  closeEditor,
  toggleSelectMode,
  toggleBookSelection,
  clearSelection,
  openCommandPalette,
  closeCommandPalette,
  setBulkEnrichment,
  updateSettings,
  toggleTheme,
} from './state/actions.js';
import { getBookById } from './state/selectors.js';
import {
  loadBooks,
  loadShelves,
  loadSettings,
  saveCover,
  getAllCovers,
  deleteCover,
} from './services/storage.js';
import { pickFiles, pickFolder } from './services/filePicker.js';
import { extractMetadata } from './services/extractors.js';
import {
  fetchGoogleBooks,
  fetchOpenLibrary,
  fetchItunes,
  fetchMusicBrainz,
} from './services/apis.js';
import { enrichBooks, cancelEnrichment } from './services/enrichment.js';
import { debounce } from './utils/debounce.js';

import { App } from './ui/components/App.js';
import { render } from './ui/renderer.js';
import { renderCommandPaletteResults } from './ui/components/CommandPalette.js';
import { showToast } from './ui/components/Toast.js';

// ── App-level mutable state (not in store — ephemeral) ──────────────────────
let covers = {};
let modalCallback = null;

// ── Initialize ──────────────────────────────────────────────────────────────

async function init() {
  const books = loadBooks();
  const shelves = loadShelves();
  const settings = loadSettings();

  initState({
    books,
    shelves,
    activeView: 'audiobooks',
    activeShelfId: null,
    filters: { format: 'all', query: '' },
    sort: {
      by: settings.sortBy || 'addedAt',
      order: settings.sortOrder || 'desc',
    },
    settings,
    ui: {
      editorBookId: null,
      selectMode: false,
      selectedBookIds: new Set(),
      commandPaletteOpen: false,
      bulkEnrichment: null,
    },
  });

  // Apply theme
  document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

  // Initial render — don't wait for IndexedDB so the UI appears immediately
  renderApp();

  // Load covers from IndexedDB in the background, then re-render
  try {
    covers = await getAllCovers();
    renderApp();
  } catch (e) {
    console.warn('Failed to load covers:', e);
  }

  // Subscribe to all state changes → re-render
  subscribe('*', () => {
    document.documentElement.setAttribute(
      'data-theme',
      getState().settings.theme || 'dark'
    );
    renderApp();
  });

  // Setup event delegation
  setupEvents();

  // Setup drag and drop
  setupDragDrop();

  // Setup keyboard shortcuts
  setupKeyboard();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderApp() {
  const root = document.getElementById('app');
  render(root, App(covers));

  // After render, focus command palette input if open
  if (getState().ui.commandPaletteOpen) {
    const input = document.getElementById('commandPaletteInput');
    if (input) input.focus();
  }
}

// ── Event Delegation ─────────────────────────────────────────────────────────

function setupEvents() {
  const root = document.getElementById('app');

  root.addEventListener('click', (e) => {
    // Don't propagate from elements that request stop
    if (
      e.target.closest('[data-stop-propagation]') &&
      !e.target.closest('[data-action]')
    )
      return;

    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    handleAction(action, el, e);
  });

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.action === 'search-input') {
      debouncedSearch(el.value);
    }
    if (
      el.dataset.action === 'command-palette-search' ||
      el.id === 'commandPaletteInput'
    ) {
      const results = document.getElementById('commandPaletteResults');
      if (results) results.innerHTML = renderCommandPaletteResults(el.value);
    }
  });
}

const debouncedSearch = debounce((query) => setSearchQuery(query), 200);

async function handleAction(action, el, _e) {
  switch (action) {
    // ── Navigation ──
    case 'select-shelf':
      setActiveShelf(
        el.dataset.shelfId === 'shelf-all' ? null : el.dataset.shelfId
      );
      closeCommandPalette();
      break;

    case 'nav':
      setView(el.dataset.view);
      closeCommandPalette();
      break;

    // ── Filters ──
    case 'set-filter':
      setFilter(el.dataset.format);
      break;

    case 'toggle-sort': {
      const { sort } = getState();
      const fields = ['addedAt', 'title', 'author', 'year', 'progress'];
      const idx = fields.indexOf(sort.by);
      const nextField = fields[(idx + 1) % fields.length];
      setSort(nextField, sort.order);
      showToast(`Sorted by ${nextField}`, 'info');
      break;
    }

    case 'cycle-grid': {
      const sizes = ['small', 'medium', 'large'];
      const { settings } = getState();
      const idx = sizes.indexOf(settings.gridSize || 'medium');
      updateSettings({ gridSize: sizes[(idx + 1) % sizes.length] });
      break;
    }

    // ── Books ──
    case 'open-book': {
      const bookId = el.dataset.bookId;
      const { ui } = getState();
      if (ui.selectMode) {
        toggleBookSelection(bookId);
      } else {
        openEditor(bookId);
      }
      break;
    }

    case 'add-files':
      closeCommandPalette();
      await handleAddFiles();
      break;

    case 'add-folder':
      await handleAddFolder();
      break;

    // ── Editor ──
    case 'close-editor':
      closeEditor();
      break;

    case 'editor-save':
      handleEditorSave();
      break;

    case 'editor-search':
      await handleEditorSearch();
      break;

    case 'apply-search-result': {
      applySearchResult(el.dataset);
      break;
    }

    case 'change-cover': {
      const input = document.getElementById('coverFileInput');
      if (input) input.click();
      input?.addEventListener('change', () => handleCoverChange(input), {
        once: true,
      });
      break;
    }

    // ── Select mode ──
    case 'toggle-select':
      toggleSelectMode();
      break;

    case 'clear-selection':
      clearSelection();
      break;

    case 'batch-delete': {
      const ids = [...getState().ui.selectedBookIds];
      if (confirm(`Delete ${ids.length} book(s)?`)) {
        for (const id of ids) await deleteCover(id);
        removeBooks(ids);
        clearSelection();
        showToast(`Deleted ${ids.length} book(s)`, 'success');
      }
      break;
    }

    case 'batch-enrich':
      await handleBulkEnrich([...getState().ui.selectedBookIds]);
      break;

    case 'batch-export':
      handleExport([...getState().ui.selectedBookIds]);
      break;

    case 'batch-shelf': {
      const shelfName = prompt('Shelf name:');
      if (shelfName) {
        let shelf = getState().shelves.find(
          (s) => s.name === shelfName && !s.isSystem
        );
        if (!shelf) shelf = createShelf(shelfName);
        addBooksToShelf(shelf.id, [...getState().ui.selectedBookIds]);
        showToast(`Added to "${shelfName}"`, 'success');
      }
      break;
    }

    // ── Shelves ──
    case 'create-shelf': {
      const name = prompt('New shelf name:');
      if (name?.trim()) {
        createShelf(name.trim());
        showToast(`Shelf "${name}" created`, 'success');
      }
      break;
    }

    case 'toggle-book-shelf': {
      const shelfId = el.dataset.shelfId;
      const bookId = el.dataset.bookId;
      const shelf = getState().shelves.find((s) => s.id === shelfId);
      if (!shelf) break;
      if (shelf.bookIds.includes(bookId)) {
        removeBooksFromShelf(shelfId, [bookId]);
      } else {
        addBooksToShelf(shelfId, [bookId]);
      }
      break;
    }

    // ── Command palette ──
    case 'close-command-palette':
      closeCommandPalette();
      break;

    case 'command-open-book':
      closeCommandPalette();
      openEditor(el.dataset.bookId);
      break;

    // ── Theme ──
    case 'toggle-theme':
      toggleTheme();
      closeCommandPalette();
      break;

    case 'set-theme':
      updateSettings({ theme: el.dataset.theme });
      break;

    case 'set-grid-size':
      updateSettings({ gridSize: el.dataset.size });
      break;

    // ── Settings ──
    case 'import-library':
      handleImportLibrary();
      break;

    case 'export-json':
      handleExport(null, 'json');
      break;

    case 'export-csv':
      handleExport(null, 'csv');
      break;

    case 'enrich-all':
      await handleBulkEnrich(getState().books.map((b) => b.id));
      break;

    case 'clear-library':
      if (confirm('Delete ALL books? This cannot be undone.')) {
        setState({ books: [] });
        covers = {};
        showToast('Library cleared', 'success');
      }
      break;

    // ── Enrichment ──
    case 'cancel-enrichment':
      cancelEnrichment();
      break;

    case 'dismiss-enrichment':
      setBulkEnrichment(null);
      break;

    // ── Modal ──
    case 'close-modal':
      document.querySelector('.modal-overlay')?.remove();
      modalCallback = null;
      break;

    case 'confirm-modal':
      modalCallback?.();
      document.querySelector('.modal-overlay')?.remove();
      modalCallback = null;
      break;
  }
}

// ── File Import ──────────────────────────────────────────────────────────────

async function handleAddFiles() {
  const files = await pickFiles();
  if (!files.length) return;
  showToast(`Importing ${files.length} file(s)...`, 'info');
  await importFiles(files);
}

async function handleAddFolder() {
  const items = await pickFolder();
  if (!items.length) return;
  showToast(`Importing folder...`, 'info');
  await importFiles(items);
}

async function importFiles(items) {
  const bookEntries = [];

  for (const item of items) {
    if (item.format === 'audiobook-folder') {
      // Multi-part audiobook: extract from first part
      const first = item.parts?.[0];
      if (!first?.file) continue;
      try {
        const meta = await extractMetadata(first.file, first.name);
        bookEntries.push({
          ...meta,
          title: meta.title || item.name,
          format: 'audiobook-folder',
          fileName: item.name,
          partCount: item.parts.length,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Extract failed for folder:', item.name, e);
        bookEntries.push({
          title: item.name,
          format: 'audiobook-folder',
          partCount: item.parts?.length || 0,
        });
      }
    } else if (item.file) {
      try {
        const meta = await extractMetadata(item.file, item.name);
        bookEntries.push({ ...meta, fileName: item.name });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Extract failed:', item.name, e);
        bookEntries.push({
          title: item.name,
          format: item.format,
          fileName: item.name,
        });
      }
    }
  }

  if (bookEntries.length === 0) return;

  const newBooks = addBooks(bookEntries);

  // Save covers to IndexedDB
  for (let i = 0; i < newBooks.length; i++) {
    const entry = bookEntries[i];
    if (entry.coverBase64) {
      await saveCover(
        newBooks[i].id,
        entry.coverBase64,
        entry.coverMime || 'image/jpeg'
      );
      covers[newBooks[i].id] = {
        base64: entry.coverBase64,
        mime: entry.coverMime || 'image/jpeg',
      };
    }
  }

  showToast(`Added ${newBooks.length} book(s)`, 'success');
  renderApp();
}

// ── Editor Save ──────────────────────────────────────────────────────────────

function handleEditorSave() {
  const { ui } = getState();
  if (!ui.editorBookId) return;

  const get = (id) => document.getElementById(id)?.value || '';

  updateBook(ui.editorBookId, {
    title: get('editTitle'),
    author: get('editAuthor'),
    narrator: get('editNarrator'),
    series: get('editSeries'),
    year: get('editYear'),
    publisher: get('editPublisher'),
    genre: get('editGenre'),
    isbn: get('editIsbn'),
    language: get('editLanguage'),
    description: get('editDescription'),
    status: get('editStatus'),
    progress: parseInt(get('editProgress'), 10) || 0,
    currentPage: get('editCurrentPage'),
    startDate: get('editStartDate'),
    finishDate: get('editFinishDate'),
    notes: get('editNotes'),
  });

  showToast('Saved', 'success');
  closeEditor();
}

// ── Editor API Search ────────────────────────────────────────────────────────

async function handleEditorSearch() {
  const { ui } = getState();
  const book = getBookById(ui.editorBookId);
  if (!book) return;

  const query = [book.title, book.author].filter(Boolean).join(' ');
  if (!query) {
    showToast('Enter a title or author first', 'info');
    return;
  }

  showToast('Searching APIs...', 'info');

  const [g, ol, it, mb] = await Promise.allSettled([
    fetchGoogleBooks(query),
    fetchOpenLibrary(query),
    fetchItunes(query),
    fetchMusicBrainz(query),
  ]);

  const results = [
    ...(g.status === 'fulfilled' ? g.value : []),
    ...(ol.status === 'fulfilled' ? ol.value : []),
    ...(it.status === 'fulfilled' ? it.value : []),
    ...(mb.status === 'fulfilled' ? mb.value : []),
  ];

  const container = document.getElementById('editorSearchResults');
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-muted);font-size:var(--text-sm)">No results found.</p>';
    return;
  }

  container.innerHTML =
    `<div class="editor-section-title">Search Results (${results.length})</div>` +
    results
      .slice(0, 12)
      .map(
        (r, i) => `
        <div class="editor-search-result" data-action="apply-search-result"
          data-index="${i}"
          data-title="${attr(r.title)}"
          data-author="${attr(r.author)}"
          data-publisher="${attr(r.publisher)}"
          data-year="${attr(r.year)}"
          data-isbn="${attr(r.isbn)}"
          data-description="${attr(r.description)}"
          data-genre="${attr(r.genre)}"
          data-language="${attr(r.language)}"
          data-narrator="${attr(r.narrator || '')}"
          data-cover-url="${attr(r.coverUrl || '')}">
          <div class="editor-search-result-cover">
            ${
              r.coverUrl
                ? `<img src="${r.coverUrl}" alt="" loading="lazy">`
                : ''
            }
          </div>
          <div class="editor-search-result-info">
            <div class="editor-search-result-title">${esc(r.title)}</div>
            <div class="editor-search-result-meta">${esc(r.author)} ${
          r.year ? `(${esc(r.year)})` : ''
        }</div>
            <div class="editor-search-result-source">${esc(r.source)}</div>
          </div>
        </div>`
      )
      .join('');
}

function applySearchResult(data) {
  const fields = {
    editTitle: data.title,
    editAuthor: data.author,
    editPublisher: data.publisher,
    editYear: data.year,
    editIsbn: data.isbn,
    editDescription: data.description,
    editGenre: data.genre,
    editLanguage: data.language,
    editNarrator: data.narrator,
  };

  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  }

  // Fetch cover if available
  if (data.coverUrl) {
    fetchCoverFromUrl(data.coverUrl);
  }

  showToast('Applied metadata', 'success');
}

async function fetchCoverFromUrl(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return;
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const mime = blob.type || 'image/jpeg';
      const { ui } = getState();
      if (ui.editorBookId) {
        await saveCover(ui.editorBookId, base64, mime);
        covers[ui.editorBookId] = { base64, mime };
        renderApp();
      }
    };
    reader.readAsDataURL(blob);
  } catch {
    // Silently fail — cover is optional
  }
}

async function handleCoverChange(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    const mime = file.type || 'image/jpeg';
    const { ui } = getState();
    if (ui.editorBookId) {
      await saveCover(ui.editorBookId, base64, mime);
      covers[ui.editorBookId] = { base64, mime };
      renderApp();
    }
  };
  reader.readAsDataURL(file);
}

// ── Bulk Enrichment ──────────────────────────────────────────────────────────

async function handleBulkEnrich(bookIds) {
  const books = bookIds.map((id) => getBookById(id)).filter(Boolean);
  if (!books.length) {
    showToast('No books to enrich', 'info');
    return;
  }

  await enrichBooks(books, {
    onProgress(p) {
      setBulkEnrichment(p);
    },
    async onBookUpdate(id, updates) {
      // Handle cover URL
      if (updates.coverUrl) {
        try {
          const resp = await fetch(updates.coverUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                const mime = blob.type || 'image/jpeg';
                await saveCover(id, base64, mime);
                covers[id] = { base64, mime };
                resolve();
              };
              reader.readAsDataURL(blob);
            });
          }
        } catch {}
        delete updates.coverUrl;
      }
      if (Object.keys(updates).length > 0) {
        updateBook(id, updates);
      }
    },
  });

  clearSelection();
}

// ── Export ────────────────────────────────────────────────────────────────────

function handleExport(bookIds = null, format = 'json') {
  const { books } = getState();
  const toExport = bookIds
    ? books.filter((b) => bookIds.includes(b.id))
    : books;

  let content, filename, mimeType;

  if (format === 'csv') {
    const headers = [
      'title',
      'author',
      'format',
      'year',
      'publisher',
      'isbn',
      'genre',
      'status',
      'progress',
    ];
    const rows = toExport.map((b) =>
      headers
        .map((h) => `"${String(b[h] || '').replace(/"/g, '""')}"`)
        .join(',')
    );
    content = [headers.join(','), ...rows].join('\n');
    filename = 'library.csv';
    mimeType = 'text/csv';
  } else {
    content = JSON.stringify(toExport, null, 2);
    filename = 'library.json';
    mimeType = 'application/json';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast(
    `Exported ${toExport.length} book(s) as ${format.toUpperCase()}`,
    'success'
  );
}

function handleImportLibrary() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      addBooks(imported);
      showToast(`Imported ${imported.length} book(s)`, 'success');
    } catch (e) {
      showToast('Invalid library file', 'error');
    }
  };
  input.click();
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────

function setupDragDrop() {
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) showDropZone();
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) hideDropZone();
  });

  document.addEventListener('dragover', (e) => e.preventDefault());

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    hideDropZone();

    const files = [...(e.dataTransfer?.files || [])].filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return [
        'epub',
        'pdf',
        'mp3',
        'm4b',
        'm4a',
        'flac',
        'ogg',
        'opus',
      ].includes(ext);
    });

    if (files.length > 0) {
      const items = files.map((f) => ({
        file: f,
        name: f.name,
        format: f.name.split('.').pop()?.toLowerCase(),
      }));
      showToast(`Importing ${items.length} file(s)...`, 'info');
      await importFiles(items);
    }
  });
}

function showDropZone() {
  if (document.querySelector('.drop-zone')) return;
  const dz = document.createElement('div');
  dz.className = 'drop-zone';
  dz.innerHTML =
    '<span class="drop-zone-text">Drop files here to import</span>';
  document.body.appendChild(dz);
}

function hideDropZone() {
  document.querySelector('.drop-zone')?.remove();
}

// ── Keyboard Shortcuts ───────────────────────────────────────────────────────

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K: Command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      getState().ui.commandPaletteOpen
        ? closeCommandPalette()
        : openCommandPalette();
    }

    // Ctrl+N: Add files
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      handleAddFiles();
    }

    // Ctrl+D: Toggle theme
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      toggleTheme();
    }

    // Ctrl+S: Save in editor
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (getState().ui.editorBookId) handleEditorSave();
    }

    // Ctrl+E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      handleExport(null, getState().settings.exportFormat || 'json');
    }

    // Escape: Close things
    if (e.key === 'Escape') {
      if (getState().ui.commandPaletteOpen) closeCommandPalette();
      else if (getState().ui.editorBookId) closeEditor();
      else if (getState().ui.selectMode) clearSelection();
    }

    // Delete: Remove selected
    if (
      e.key === 'Delete' &&
      getState().ui.selectMode &&
      getState().ui.selectedBookIds.size > 0
    ) {
      const ids = [...getState().ui.selectedBookIds];
      if (confirm(`Delete ${ids.length} book(s)?`)) {
        removeBooks(ids);
        clearSelection();
        showToast(`Deleted ${ids.length} book(s)`, 'success');
      }
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Boot ─────────────────────────────────────────────────────────────────────

init().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Init failed:', e);
  const app = document.getElementById('app');
  if (app) {
    app.style.display = 'block';
    app.innerHTML = `
      <div style="padding:40px;color:#f44;font-family:monospace;background:#111;min-height:100vh">
        <h1>Failed to initialize</h1>
        <pre>${String(e?.message || e)}</pre>
        <pre>${String(e?.stack || '')}</pre>
      </div>
    `;
  }
});
