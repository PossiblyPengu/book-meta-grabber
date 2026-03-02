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
  batchUpdateBooks,
  addSession,
  removeBooks,
  createShelf,
  createSmartShelf,
  addBooksToShelf,
  removeBooksFromShelf,
  setView,
  setActiveShelf,
  setFilter,
  setSearchQuery,
  setSort,
  openEditor,
  closeEditor,
  openDetailView,
  closeDetailView,
  setNowPlaying,
  addBookmark,
  removeBookmark,
  updatePlaybackSpeed,
  toggleSelectMode,
  toggleBookSelection,
  clearSelection,
  openCommandPalette,
  closeCommandPalette,
  setBulkEnrichment,
  updateSettings,
  toggleTheme,
  logActivity,
} from './state/actions.js';
import {
  getBookById,
  isAudioFormat,
  isEbookFormat,
} from './state/selectors.js';
import {
  loadBooks,
  loadShelves,
  loadSettings,
  loadActivityLog,
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
import { trapFocus } from './utils/focusTrap.js';
import { isScannerSupported, startScanner } from './utils/barcodeScanner.js';

import { App } from './ui/components/App.js';
import { Modal } from './ui/components/Modal.js';
import { render } from './ui/renderer.js';
import { renderCommandPaletteResults } from './ui/components/CommandPalette.js';
import { showToast } from './ui/components/Toast.js';

// ── App-level mutable state (not in store — ephemeral) ──────────────────────
let covers = {};
let modalCallback = null;
let releaseFocusTrap = null;

// ── Reading Timer State ─────────────────────────────────────────────────────
let timerInterval = null;
let timerStartTime = null;
let timerPausedElapsed = 0;
let timerRunning = false;
let timerBookId = null;

function stopTimerCleanup() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerStartTime = null;
  timerPausedElapsed = 0;
  timerRunning = false;
  timerBookId = null;
}

function getTimerElapsed() {
  if (!timerStartTime) return timerPausedElapsed;
  return timerPausedElapsed + (Date.now() - timerStartTime);
}

function formatTimerDisplay(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(
    s
  ).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  if (display) display.textContent = formatTimerDisplay(getTimerElapsed());
}

// ── Initialize ──────────────────────────────────────────────────────────────

async function init() {
  const books = loadBooks();
  const shelves = loadShelves();
  const settings = loadSettings();
  const activityLog = loadActivityLog();

  initState({
    books,
    shelves,
    activityLog,
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
      detailBookId: null,
      selectMode: false,
      selectedBookIds: new Set(),
      commandPaletteOpen: false,
      batchEditorOpen: false,
      bulkEnrichment: null,
    },
  });

  // Apply theme
  function resolveTheme(t) {
    if (t === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return t || 'dark';
  }
  function applyTheme(theme, color) {
    const effective = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-color', color || 'violet');
  }
  applyTheme(settings.theme, settings.colorTheme);

  // Listen for system color scheme changes when auto
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const s = getState().settings;
      if (s.theme === 'auto') {
        applyTheme(s.theme, s.colorTheme);
      }
    });

  // Initial render — don't wait for IndexedDB so the UI appears immediately
  renderApp();

  // Load covers from IndexedDB in the background, then re-render
  try {
    covers = await getAllCovers();
    renderApp();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to load covers:', e);
  }

  // Subscribe to all state changes → re-render
  subscribe('*', () => {
    const s = getState().settings;
    applyTheme(s.theme, s.colorTheme);
    renderApp();
  });

  // Setup event delegation
  setupEvents();

  // Setup drag and drop
  setupDragDrop();

  // Setup keyboard shortcuts
  setupKeyboard();
}

// ── Confirm Dialog (replaces window.confirm) ─────────────────────────────

function showConfirm(title, body, onConfirm, danger = true) {
  const html = Modal({
    title,
    body,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger,
  });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstElementChild);
  modalCallback = onConfirm;
  // Focus trap the modal
  const modal = document.querySelector('.modal-overlay .modal');
  if (modal) {
    if (releaseFocusTrap) releaseFocusTrap();
    releaseFocusTrap = trapFocus(modal);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderApp() {
  const root = document.getElementById('app');
  render(root, App(covers));

  // Release any previous focus trap
  if (releaseFocusTrap) {
    releaseFocusTrap();
    releaseFocusTrap = null;
  }

  // Apply focus trapping to topmost overlay
  const modal = document.querySelector('.modal-overlay .modal');
  const cmdPalette = document.querySelector('.command-palette');
  const editorPanel = document.querySelector('.editor-panel.open');
  const detailView = document.querySelector('.detail-view.open');

  if (modal) {
    releaseFocusTrap = trapFocus(modal);
  } else if (cmdPalette) {
    releaseFocusTrap = trapFocus(cmdPalette);
  } else if (editorPanel) {
    releaseFocusTrap = trapFocus(editorPanel);
  } else if (detailView) {
    releaseFocusTrap = trapFocus(detailView);
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
    if (el.dataset.action === 'set-daily-goal') {
      const val = parseInt(el.value, 10);
      if (val > 0) updateSettings({ dailyGoal: val });
    }
    if (el.dataset.action === 'set-yearly-goal') {
      const val = parseInt(el.value, 10);
      if (val > 0) updateSettings({ yearlyGoal: val });
    }
    if (el.dataset.action === 'audio-scrub') {
      handleAction('audio-scrub', el, e);
    }
  });

  // Handle Enter key in tag input
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'tagInput') {
      e.preventDefault();
      handleAction('add-tag', e.target, e);
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
        openDetailView(bookId);
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
      stopTimerCleanup();
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
      showConfirm(
        'Delete Books',
        `Are you sure you want to delete ${ids.length} book(s)? This cannot be undone.`,
        async () => {
          for (const id of ids) await deleteCover(id);
          removeBooks(ids);
          clearSelection();
          showToast(`Deleted ${ids.length} book(s)`, 'success');
        }
      );
      break;
    }

    case 'batch-edit':
      setState({
        ui: { ...getState().ui, batchEditorOpen: true },
      });
      break;

    case 'close-batch-editor':
      setState({
        ui: { ...getState().ui, batchEditorOpen: false },
      });
      break;

    case 'batch-edit-save': {
      const ids = [...getState().ui.selectedBookIds];
      const updates = {};
      const bStatus = document.getElementById('batchStatus')?.value;
      const bGenre = document.getElementById('batchGenre')?.value?.trim();
      const bSeries = document.getElementById('batchSeries')?.value?.trim();
      const bProgress = document.getElementById('batchProgress')?.value;
      if (bStatus) updates.status = bStatus;
      if (bGenre) updates.genre = bGenre;
      if (bSeries) updates.series = bSeries;
      if (bProgress !== '' && bProgress != null)
        updates.progress = parseInt(bProgress, 10) || 0;
      if (Object.keys(updates).length === 0) {
        showToast('No fields to update', 'info');
        break;
      }
      batchUpdateBooks(ids, updates);
      setState({
        ui: { ...getState().ui, batchEditorOpen: false },
      });
      clearSelection();
      showToast(`Updated ${ids.length} book(s)`, 'success');
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

    case 'scan-isbn':
      closeCommandPalette();
      handleScanIsbn();
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

    case 'set-color-theme':
      updateSettings({ colorTheme: el.dataset.color });
      break;

    // ── Settings ──
    case 'import-library':
      handleImportLibrary();
      break;

    case 'import-goodreads':
      handleImportGoodreads();
      break;

    case 'export-json':
      handleExport(null, 'json');
      break;

    case 'export-csv':
      handleExport(null, 'csv');
      break;

    case 'create-smart-shelf': {
      const presets = {
        'top-rated': {
          name: 'Top Rated',
          rules: [{ field: 'rating', op: 'gte', value: 4 }],
        },
        favorites: {
          name: 'Favorites',
          rules: [{ field: 'favorite', op: 'equals', value: 'true' }],
        },
        'long-books': {
          name: 'Almost Done',
          rules: [{ field: 'progress', op: 'gt', value: 80 }],
        },
      };
      const preset = presets[el.dataset.preset];
      if (preset) {
        createSmartShelf(preset.name, preset.rules);
        showToast(`Smart shelf "${preset.name}" created`, 'success');
      }
      break;
    }

    case 'enrich-all':
      await handleBulkEnrich(getState().books.map((b) => b.id));
      break;

    case 'clear-library':
      showConfirm(
        'Clear Library',
        'Delete ALL books? This cannot be undone.',
        () => {
          setState({ books: [] });
          covers = {};
          showToast('Library cleared', 'success');
        }
      );
      break;

    // ── Sessions ──
    case 'log-session': {
      const bookId = el.dataset.bookId;
      const date = document.getElementById('sessionDate')?.value;
      const minutes = parseInt(
        document.getElementById('sessionMinutes')?.value,
        10
      );
      if (!minutes || minutes <= 0) {
        showToast('Enter a valid duration', 'info');
        break;
      }
      const notes = document.getElementById('sessionNotes')?.value?.trim();
      addSession(bookId, {
        id: Date.now().toString(36),
        date: date || new Date().toISOString().slice(0, 10),
        durationMinutes: minutes,
        notes: notes || '',
        loggedAt: new Date().toISOString(),
      });
      logActivity(minutes);
      showToast(`Logged ${minutes} min session`, 'success');
      break;
    }

    // ── Star Ratings ──
    case 'set-rating': {
      const { ui } = getState();
      if (ui.editorBookId) {
        const rating = parseInt(el.dataset.rating, 10);
        updateBook(ui.editorBookId, { rating });
      }
      break;
    }

    // ── Tags ──
    case 'add-tag': {
      const { ui } = getState();
      const input = document.getElementById('tagInput');
      const tag = input?.value?.trim();
      if (!tag || !ui.editorBookId) break;
      const book = getBookById(ui.editorBookId);
      const tags = [...(book?.tags || [])];
      if (!tags.includes(tag)) {
        tags.push(tag);
        updateBook(ui.editorBookId, { tags });
        showToast(`Tag "${tag}" added`, 'success');
      }
      break;
    }

    case 'remove-tag': {
      const { ui } = getState();
      if (!ui.editorBookId) break;
      const book = getBookById(ui.editorBookId);
      const tags = [...(book?.tags || [])];
      const idx = parseInt(el.dataset.tagIndex, 10);
      if (idx >= 0 && idx < tags.length) {
        tags.splice(idx, 1);
        updateBook(ui.editorBookId, { tags });
      }
      break;
    }

    // ── Reading Timer ──
    case 'timer-start': {
      timerBookId = el.dataset.bookId;
      timerStartTime = Date.now();
      timerPausedElapsed = 0;
      timerRunning = true;
      timerInterval = setInterval(updateTimerDisplay, 1000);
      // Auto-set as now playing
      setNowPlaying(timerBookId);
      // Toggle button visibility
      const startBtn = document.getElementById('timerStartBtn');
      const pauseBtn = document.getElementById('timerPauseBtn');
      const stopBtn = document.getElementById('timerStopBtn');
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = '';
      if (stopBtn) stopBtn.style.display = '';
      break;
    }

    case 'timer-pause': {
      timerPausedElapsed = getTimerElapsed();
      timerStartTime = null;
      timerRunning = false;
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
      const pauseBtn = document.getElementById('timerPauseBtn');
      const resumeBtn = document.getElementById('timerResumeBtn');
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = '';
      break;
    }

    case 'timer-resume': {
      timerStartTime = Date.now();
      timerRunning = true;
      timerInterval = setInterval(updateTimerDisplay, 1000);
      const pauseBtn = document.getElementById('timerPauseBtn');
      const resumeBtn = document.getElementById('timerResumeBtn');
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = '';
      break;
    }

    case 'timer-stop': {
      const elapsed = getTimerElapsed();
      const minutes = Math.round(elapsed / 60000);
      const bookId = timerBookId || el.dataset.bookId;
      stopTimerCleanup();
      if (minutes > 0 && bookId) {
        addSession(bookId, {
          id: Date.now().toString(36),
          date: new Date().toISOString().slice(0, 10),
          durationMinutes: minutes,
          notes: 'Timer session',
          loggedAt: new Date().toISOString(),
        });
        logActivity(minutes);
        showToast(`Logged ${minutes} min from timer`, 'success');
      } else {
        showToast('Session too short to log', 'info');
      }
      break;
    }

    // ── Detail View ──
    case 'open-detail': {
      const bookId = el.dataset.bookId;
      if (bookId) openDetailView(bookId);
      break;
    }

    case 'close-detail':
      closeDetailView();
      break;

    case 'open-editor-from-detail': {
      closeDetailView();
      openEditor(el.dataset.bookId);
      break;
    }

    case 'set-now-playing': {
      setNowPlaying(el.dataset.bookId);
      showToast('Set as Now Playing', 'success');
      break;
    }

    case 'quick-progress-up': {
      const bookId = el.dataset.bookId;
      const book = getBookById(bookId);
      if (book) {
        const newProg = Math.min(100, (book.progress || 0) + 5);
        updateBook(bookId, { progress: newProg });
        if (newProg === 100) {
          updateBook(bookId, {
            status: 'finished',
            finishDate: new Date().toISOString().slice(0, 10),
          });
          showToast('Finished!', 'success');
        } else {
          showToast(`Progress: ${newProg}%`, 'info');
        }
      }
      break;
    }

    case 'quick-progress-down': {
      const bookId = el.dataset.bookId;
      const book = getBookById(bookId);
      if (book) {
        const newProg = Math.max(0, (book.progress || 0) - 5);
        updateBook(bookId, { progress: newProg });
        showToast(`Progress: ${newProg}%`, 'info');
      }
      break;
    }

    case 'quick-progress-set': {
      const bookId = el.dataset.bookId;
      const progress = parseInt(el.dataset.progress, 10);
      if (bookId && !isNaN(progress)) {
        updateBook(bookId, { progress: Math.max(0, Math.min(100, progress)) });
        showToast(`Progress: ${progress}%`, 'info');
      }
      break;
    }

    case 'mark-finished': {
      const bookId = el.dataset.bookId;
      updateBook(bookId, {
        progress: 100,
        status: 'finished',
        finishDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Marked as finished!', 'success');
      break;
    }

    case 'toggle-now-playing-timer': {
      const bookId = el.dataset.bookId;
      if (timerRunning && timerBookId === bookId) {
        // Pause
        timerPausedElapsed = getTimerElapsed();
        timerStartTime = null;
        timerRunning = false;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        showToast('Timer paused', 'info');
      } else if (
        !timerRunning &&
        timerBookId === bookId &&
        timerPausedElapsed > 0
      ) {
        // Resume
        timerStartTime = Date.now();
        timerRunning = true;
        timerInterval = setInterval(updateTimerDisplay, 1000);
        showToast('Timer resumed', 'info');
      } else {
        // Start new timer
        if (timerRunning) stopTimerCleanup();
        timerBookId = bookId;
        timerStartTime = Date.now();
        timerPausedElapsed = 0;
        timerRunning = true;
        timerInterval = setInterval(updateTimerDisplay, 1000);
        setNowPlaying(bookId);
        showToast('Timer started', 'info');
      }
      break;
    }

    case 'audio-scrub': {
      const bookId = el.dataset.bookId;
      const value = parseInt(el.value, 10);
      if (bookId && !isNaN(value)) {
        updateBook(bookId, { progress: value });
      }
      break;
    }

    case 'audio-skip-back': {
      const bookId = el.dataset.bookId;
      const book = getBookById(bookId);
      if (book) {
        const newProg = Math.max(0, (book.progress || 0) - 1);
        updateBook(bookId, { progress: newProg });
      }
      break;
    }

    case 'audio-skip-forward': {
      const bookId = el.dataset.bookId;
      const book = getBookById(bookId);
      if (book) {
        const newProg = Math.min(100, (book.progress || 0) + 1);
        updateBook(bookId, { progress: newProg });
      }
      break;
    }

    case 'set-playback-speed': {
      const speed = parseFloat(el.dataset.speed);
      if (!isNaN(speed)) {
        updatePlaybackSpeed(speed);
        showToast(`Playback speed: ${speed}x`, 'info');
      }
      break;
    }

    case 'add-bookmark': {
      const bookId = el.dataset.bookId;
      const book = getBookById(bookId);
      if (book) {
        const label = prompt('Bookmark label:');
        if (label?.trim()) {
          addBookmark(bookId, {
            id: Date.now().toString(36),
            label: label.trim(),
            position: book.currentPage || `${book.progress || 0}%`,
            createdAt: new Date().toISOString(),
          });
          showToast('Bookmark added', 'success');
        }
      }
      break;
    }

    case 'remove-bookmark': {
      const bookId = el.dataset.bookId;
      const bookmarkId = el.dataset.bookmarkId;
      if (bookId && bookmarkId) {
        removeBookmark(bookId, bookmarkId);
        showToast('Bookmark removed', 'info');
      }
      break;
    }

    case 'add-timestamped-note': {
      const bookId = el.dataset.bookId;
      const book = getBookById(bookId);
      if (book) {
        const text = prompt('Note:');
        if (text?.trim()) {
          const tsNotes = [
            ...(book.timestampedNotes || []),
            {
              id: Date.now().toString(36),
              text: text.trim(),
              timestamp: new Date().toLocaleString(),
              position: book.currentPage || `${book.progress || 0}%`,
              createdAt: new Date().toISOString(),
            },
          ];
          updateBook(bookId, { timestampedNotes: tsNotes });
          showToast('Note added', 'success');
        }
      }
      break;
    }

    case 'remove-ts-note': {
      const bookId = el.dataset.bookId;
      const noteId = el.dataset.noteId;
      const book = getBookById(bookId);
      if (book && noteId) {
        const tsNotes = (book.timestampedNotes || []).filter(
          (n) => n.id !== noteId
        );
        updateBook(bookId, { timestampedNotes: tsNotes });
        showToast('Note removed', 'info');
      }
      break;
    }

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
      if (releaseFocusTrap) {
        releaseFocusTrap();
        releaseFocusTrap = null;
      }
      break;

    case 'confirm-modal':
      modalCallback?.();
      document.querySelector('.modal-overlay')?.remove();
      modalCallback = null;
      if (releaseFocusTrap) {
        releaseFocusTrap();
        releaseFocusTrap = null;
      }
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

  // ── Feature 1: Duplicate detection ──
  const { books: existingBooks } = getState();
  const makeKey = (t, a) =>
    `${(t || '').toLowerCase()}::${(a || '').toLowerCase()}`;
  const existingKeys = new Set(
    existingBooks.map((b) => makeKey(b.title, b.author))
  );
  const existingFiles = new Set(
    existingBooks.map((b) => (b.fileName || '').toLowerCase())
  );
  const existingIsbns = new Set(
    existingBooks.filter((b) => b.isbn).map((b) => b.isbn.replace(/[-\s]/g, ''))
  );

  const unique = [];
  let dupCount = 0;
  for (const entry of bookEntries) {
    const key = makeKey(entry.title, entry.author);
    const fileKey = (entry.fileName || '').toLowerCase();
    const isbnKey = entry.isbn ? entry.isbn.replace(/[-\s]/g, '') : '';
    if (
      existingKeys.has(key) ||
      existingFiles.has(fileKey) ||
      (isbnKey && existingIsbns.has(isbnKey))
    ) {
      dupCount++;
    } else {
      unique.push(entry);
      existingKeys.add(key);
      existingFiles.add(fileKey);
      if (isbnKey) existingIsbns.add(isbnKey);
    }
  }

  if (dupCount > 0) {
    showToast(`${dupCount} duplicate(s) skipped`, 'warning');
  }
  if (unique.length === 0) return;

  const newBooks = addBooks(unique);

  // Save covers to IndexedDB
  for (let i = 0; i < newBooks.length; i++) {
    const entry = unique[i];
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

  // ── Feature 2: Auto-shelf on import ──
  const audioIds = [];
  const ebookIds = [];
  for (const book of newBooks) {
    if (isAudioFormat(book.format)) audioIds.push(book.id);
    else if (isEbookFormat(book.format)) ebookIds.push(book.id);
  }

  const { shelves } = getState();
  if (audioIds.length > 0) {
    let audioShelf = shelves.find(
      (s) => !s.isSystem && s.name === 'Audiobooks'
    );
    if (!audioShelf) audioShelf = createShelf('Audiobooks', '#8B5CF6');
    addBooksToShelf(audioShelf.id, audioIds);
  }
  if (ebookIds.length > 0) {
    let ebookShelf = shelves.find((s) => !s.isSystem && s.name === 'Ebooks');
    if (!ebookShelf) ebookShelf = createShelf('Ebooks', '#3b82f6');
    addBooksToShelf(ebookShelf.id, ebookIds);
  }

  showToast(`Added ${newBooks.length} book(s)`, 'success');
  renderApp();
}

// ── Editor Save ──────────────────────────────────────────────────────────────

function handleEditorSave() {
  const { ui } = getState();
  if (!ui.editorBookId) return;

  const get = (id) => document.getElementById(id)?.value || '';

  const title = get('editTitle').trim();
  const author = get('editAuthor').trim();
  if (!title) {
    showToast('Title is required', 'error');
    return;
  }
  if (!author) {
    showToast('Author is required', 'error');
    return;
  }

  updateBook(ui.editorBookId, {
    title,
    author,
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
    rating: getBookById(ui.editorBookId)?.rating || 0,
    tags: getBookById(ui.editorBookId)?.tags || [],
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
    overwrite: true,
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
      'narrator',
      'series',
      'format',
      'year',
      'publisher',
      'isbn',
      'genre',
      'language',
      'description',
      'status',
      'progress',
      'rating',
      'favorite',
      'tags',
      'notes',
      'duration',
      'startDate',
      'finishDate',
      'addedAt',
      'sessions',
      'totalMinutesRead',
    ];
    const rows = toExport.map((b) => {
      const vals = {
        ...b,
        tags: (b.tags || []).join('; '),
        sessions: (b.sessions || []).length,
        totalMinutesRead: (b.sessions || []).reduce(
          (sum, s) => sum + (s.minutes || 0),
          0
        ),
      };
      return headers
        .map((h) => `"${String(vals[h] ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
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

async function handleScanIsbn() {
  if (!isScannerSupported()) {
    showToast('Barcode scanning not supported in this browser', 'error');
    return;
  }

  // Create scanner overlay
  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-header">
      <span>Scan ISBN Barcode</span>
      <button class="btn-icon" id="scannerClose" aria-label="Close">&times;</button>
    </div>
    <div class="scanner-viewport" id="scannerViewport"></div>
    <p class="scanner-hint">Point camera at a book's ISBN barcode</p>
  `;
  document.body.appendChild(overlay);

  const scanner = await startScanner(
    async (isbn) => {
      scanner?.stop();
      overlay.remove();
      showToast(`ISBN detected: ${isbn}`, 'success');

      // Look up the ISBN via APIs
      try {
        const results = await fetchOpenLibrary(`isbn:${isbn}`);
        if (results?.length) {
          const bookData = results[0];
          addBooks([{ ...bookData, isbn, format: 'epub' }]);
          showToast(`Added: ${bookData.title || isbn}`, 'success');
        } else {
          addBooks([
            { title: `ISBN ${isbn}`, author: '', isbn, format: 'epub' },
          ]);
          showToast('Book added — enrich to fill metadata', 'info');
        }
      } catch {
        addBooks([{ title: `ISBN ${isbn}`, author: '', isbn, format: 'epub' }]);
        showToast('Book added — enrich to fill metadata', 'info');
      }
    },
    (err) => {
      overlay.remove();
      showToast(err, 'error');
    }
  );

  if (!scanner) {
    overlay.remove();
    return;
  }

  // Attach video to viewport
  const viewport = overlay.querySelector('#scannerViewport');
  scanner.video.className = 'scanner-video';
  viewport.appendChild(scanner.video);

  // Close button
  overlay.querySelector('#scannerClose').onclick = () => {
    scanner.stop();
    overlay.remove();
  };
}

function handleImportGoodreads() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const books = parseGoodreadsCsv(text);
      if (!books.length) {
        showToast('No books found in CSV', 'info');
        return;
      }
      addBooks(books);
      showToast(`Imported ${books.length} book(s) from Goodreads`, 'success');
    } catch (e) {
      showToast('Failed to parse CSV file', 'error');
    }
  };
  input.click();
}

function parseGoodreadsCsv(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCsvRow(lines[0]);
  const col = (name) =>
    headers.findIndex((h) => h.toLowerCase().trim() === name.toLowerCase());

  const iTitle = col('title');
  const iAuthor = col('author');
  const iIsbn = col('isbn13') !== -1 ? col('isbn13') : col('isbn');
  const iRating = col('my rating');
  const iYear =
    col('year published') !== -1
      ? col('year published')
      : col('original publication year');
  const iShelf = col('exclusive shelf');
  const iDateRead = col('date read');
  const iReview = col('my review');
  const iPublisher = col('publisher');

  if (iTitle === -1 || iAuthor === -1) return [];

  const books = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = parseCsvRow(lines[i]);
    if (!row[iTitle]) continue;

    const shelfStatus = {
      'currently-reading': 'reading',
      read: 'finished',
      'to-read': 'unread',
    };

    const rating = iRating !== -1 ? parseInt(row[iRating], 10) || 0 : 0;

    books.push({
      title: row[iTitle]?.trim() || '',
      author: row[iAuthor]?.trim() || '',
      isbn: iIsbn !== -1 ? (row[iIsbn] || '').replace(/[="]/g, '').trim() : '',
      rating: rating > 0 ? rating : 0,
      year: iYear !== -1 ? (row[iYear] || '').trim() : '',
      status:
        iShelf !== -1 ? shelfStatus[row[iShelf]?.trim()] || 'unread' : 'unread',
      finishDate: iDateRead !== -1 ? (row[iDateRead] || '').trim() : '',
      notes: iReview !== -1 ? (row[iReview] || '').trim() : '',
      publisher: iPublisher !== -1 ? (row[iPublisher] || '').trim() : '',
      progress: iShelf !== -1 && row[iShelf]?.trim() === 'read' ? 100 : 0,
      format: 'epub',
    });
  }
  return books;
}

function parseCsvRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        result.push(current);
        current = '';
      } else current += ch;
    }
  }
  result.push(current);
  return result;
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
      else if (getState().ui.detailBookId) closeDetailView();
      else if (getState().ui.selectMode) clearSelection();
    }

    // Arrow keys: Navigate book grid
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const grid = document.querySelector('.book-grid');
      if (
        !grid ||
        getState().ui.editorBookId ||
        getState().ui.detailBookId ||
        getState().ui.commandPaletteOpen
      )
        return;

      const cards = [...grid.querySelectorAll('.book-card')];
      if (!cards.length) return;

      const focused = document.activeElement?.closest('.book-card');
      let idx = focused ? cards.indexOf(focused) : -1;

      // Calculate columns from grid
      const cols = Math.round(grid.offsetWidth / cards[0].offsetWidth) || 1;

      if (idx === -1) {
        idx = 0;
      } else {
        e.preventDefault();
        if (e.key === 'ArrowRight') idx = Math.min(idx + 1, cards.length - 1);
        else if (e.key === 'ArrowLeft') idx = Math.max(idx - 1, 0);
        else if (e.key === 'ArrowDown')
          idx = Math.min(idx + cols, cards.length - 1);
        else if (e.key === 'ArrowUp') idx = Math.max(idx - cols, 0);
      }

      cards[idx].setAttribute('tabindex', '0');
      cards[idx].focus();
      // Clean up other tabindexes
      cards.forEach((c, i) => {
        if (i !== idx) c.removeAttribute('tabindex');
      });
    }

    // Enter: Open focused book card
    if (e.key === 'Enter' && document.activeElement?.closest('.book-card')) {
      const card = document.activeElement.closest('.book-card');
      const bookId = card.dataset.bookId;
      if (bookId) {
        e.preventDefault();
        openDetailView(bookId);
      }
    }

    // Delete: Remove selected
    if (
      e.key === 'Delete' &&
      getState().ui.selectMode &&
      getState().ui.selectedBookIds.size > 0
    ) {
      const ids = [...getState().ui.selectedBookIds];
      showConfirm(
        'Delete Books',
        `Are you sure you want to delete ${ids.length} book(s)?`,
        () => {
          removeBooks(ids);
          clearSelection();
          showToast(`Deleted ${ids.length} book(s)`, 'success');
        }
      );
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
