/**
 * src/app.js
 * Main application logic
 */

import './styles.css';
import { extractMetadata } from './extractors/index.js';
import {
  fetchGoogleBooks,
  fetchOpenLibrary,
  fetchItunes,
  fetchMusicBrainz,
} from './apis/index.js';
import {
  loadLibrary,
  saveLibrary,
  loadSettings,
  saveSettings,
} from './storage.js';
import { pickFromFiles, pickFolder } from './fileSources.js';
import { combineAudioFiles } from './utils/audioCombiner.js';
import { parseFileName } from './utils/filenameParser.js';

// ===== APPLICATION STATE =====
const state = {
  books: [],
  activeTab: 'library',
  filterFormat: 'all',
  processing: false, // Lock for async file processing
  settings: {
    gdriveClientId: '',
    theme: 'dark',
    exportFormat: 'json',
    // QOL Settings
    autoSave: true,
    showProgress: true,
    compactView: false,
    sortBy: 'addedDate', // 'title', 'author', 'addedDate', 'progress'
    sortOrder: 'desc', // 'asc', 'desc'
    keyboardShortcuts: true,
    animations: true,
    gridSize: 'medium', // 'small', 'medium', 'large'
  },
  currentEditingBook: null,
  selectMode: false,
  selectedBooks: new Set(),
  // QOL State
  searchQuery: '',
  recentSearches: [],
  favorites: new Set(),
  lastViewedBook: null,
  shortcuts: {
    'Ctrl+K': 'openSearch',
    'Ctrl+N': 'addBook',
    'Ctrl+E': 'exportLibrary',
    'Ctrl+F': 'filterLibrary',
    Escape: 'closeModal',
    'Ctrl+D': 'toggleDarkMode',
    'Ctrl+S': 'saveCurrent',
    Delete: 'deleteSelected',
  },
};

// ===== DOM REFERENCES =====
const elements = {
  bookGrid: document.getElementById('bookGrid'),
  emptyState: document.getElementById('emptyState'),
  libraryTab: document.getElementById('libraryTab'),
  searchTab: document.getElementById('searchTab'),
  settingsTab: document.getElementById('settingsTab'),
  searchInput: document.getElementById('searchInput'),
  searchResults: document.getElementById('searchResults'),
  gdriveInput: document.getElementById('gdriveInput'),
  exportFormat: document.getElementById('exportFormat'),
  exportSelectedBtn: document.getElementById('exportSelectedBtn'),
  lightThemeBtn: document.getElementById('lightThemeBtn'),
  darkThemeBtn: document.getElementById('darkThemeBtn'),
  tabButtons: document.querySelectorAll('.tab-button'),
  filterChips: document.querySelectorAll('.filter-chip'),
  // Batch operations
  batchActions: document.getElementById('batchActions'),
  selectedCount: document.getElementById('selectedCount'),
  batchEditBtn: document.getElementById('batchEditBtn'),
  batchExportBtn: document.getElementById('batchExportBtn'),
  batchDeleteBtn: document.getElementById('batchDeleteBtn'),
  batchCancelBtn: document.getElementById('batchCancelBtn'),
  selectModeBtn: document.getElementById('selectModeBtn'),
  // Editor elements
  editorModal: document.getElementById('editorModal'),
  editorBackdrop: document.getElementById('editorBackdrop'),
  editorCloseBtn: document.getElementById('editorCloseBtn'),
  editorSaveBtn: document.getElementById('editorSaveBtn'),
  editorSearchBtn: document.getElementById('editorSearchBtn'),
  editorSearchResults: document.getElementById('editorSearchResults'),
  editorSearchClose: document.getElementById('editorSearchClose'),
  editorSearchList: document.getElementById('editorSearchList'),
  editorCover: document.getElementById('editorCover'),
  editorCoverImg: document.getElementById('editorCoverImg'),
  editorCoverPlaceholder: document.getElementById('editorCoverPlaceholder'),
  editorCoverBtn: document.getElementById('editorCoverBtn'),
  coverInput: document.getElementById('coverInput'),
  editorHero: document.getElementById('editorHero'),
  editorAudioFields: document.getElementById('editorAudioFields'),
  // Progress fields
  editStatus: document.getElementById('editStatus'),
  editProgress: document.getElementById('editProgress'),
  editCurrentPage: document.getElementById('editCurrentPage'),
  editStartDate: document.getElementById('editStartDate'),
  editFinishDate: document.getElementById('editFinishDate'),
  editNotes: document.getElementById('editNotes'),
  // Form inputs
  editTitle: document.getElementById('editTitle'),
  editAuthor: document.getElementById('editAuthor'),
  editNarrator: document.getElementById('editNarrator'),
  editSeries: document.getElementById('editSeries'),
  editYear: document.getElementById('editYear'),
  editPublisher: document.getElementById('editPublisher'),
  editGenre: document.getElementById('editGenre'),
  editIsbn: document.getElementById('editIsbn'),
  editLanguage: document.getElementById('editLanguage'),
  editDescription: document.getElementById('editDescription'),
  editDuration: document.getElementById('editDuration'),
  editBitrate: document.getElementById('editBitrate'),
};

// ===== INITIALIZATION =====
export async function init() {
  await loadAppState();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupQuickSearch();
  setupSortDropdown();
  renderBooks();
  updateTabDisplay();
  updateThemeUI();
  updateSortUI();
}

// ===== STATE MANAGEMENT =====
async function saveAppState() {
  await saveLibrary(state.books);
  await saveSettings(state.settings);
}

async function loadAppState() {
  state.books = await loadLibrary();
  const savedSettings = await loadSettings();
  Object.assign(state.settings, savedSettings);

  // Apply initial settings
  if (state.settings.gdriveClientId) {
    elements.gdriveInput.value = state.settings.gdriveClientId;
  }
  elements.exportFormat.value = state.settings.exportFormat;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Tab navigation
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      switchTab(tab);
    });
  });

  // Filter chips
  elements.filterChips.forEach((chip) => {
    if (chip.id === 'selectModeBtn') {
      chip.addEventListener('click', toggleSelectMode);
    } else {
      chip.addEventListener('click', () => {
        const format = chip.dataset.format;
        setFilter(format);
      });
    }
  });

  // Header buttons
  document
    .getElementById('searchBtn')
    .addEventListener('click', () => switchTab('search'));
  document
    .getElementById('addBtn')
    .addEventListener('click', () => handleAddBook());
  document
    .getElementById('emptyAddBtn')
    .addEventListener('click', () => handleAddBook());

  // Search
  document
    .getElementById('searchSubmitBtn')
    .addEventListener('click', () => performSearch());
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Settings
  document
    .getElementById('exportBtn')
    .addEventListener('click', () => exportLibraryAction());
  document
    .getElementById('exportSelectedBtn')
    .addEventListener('click', () => exportSelected());
  document
    .getElementById('clearLibraryBtn')
    .addEventListener('click', () => clearLibraryAction());
  elements.gdriveInput.addEventListener('change', () => {
    state.settings.gdriveClientId = elements.gdriveInput.value;
    saveAppState();
  });
  elements.exportFormat.addEventListener('change', () => {
    state.settings.exportFormat = elements.exportFormat.value;
    saveAppState();
  });

  // Theme
  elements.lightThemeBtn.addEventListener('click', () => setTheme('light'));
  elements.darkThemeBtn.addEventListener('click', () => setTheme('dark'));

  // Batch operations
  elements.batchCancelBtn.addEventListener('click', exitSelectMode);
  elements.batchEditBtn.addEventListener('click', batchEdit);
  elements.batchExportBtn.addEventListener('click', batchExport);
  elements.batchDeleteBtn.addEventListener('click', batchDelete);

  // Editor event listeners
  elements.editorCloseBtn.addEventListener('click', closeEditor);
  elements.editorBackdrop.addEventListener('click', closeEditor);
  elements.editorSaveBtn.addEventListener('click', saveEditor);
  elements.editorSearchBtn.addEventListener('click', searchInEditor);
  elements.editorSearchClose.addEventListener('click', closeEditorSearch);
  elements.editorCoverBtn.addEventListener('click', () =>
    elements.coverInput.click()
  );
  elements.coverInput.addEventListener('change', handleCoverUpload);

  // Header buttons
  document
    .getElementById('sortBtn')
    .addEventListener('click', toggleSortDropdown);
  document
    .getElementById('gridSizeBtn')
    .addEventListener('click', cycleGridSize);
  document
    .getElementById('viewModeBtn')
    .addEventListener('click', toggleViewMode);
  document
    .getElementById('shortcutsHelpBtn')
    .addEventListener('click', showShortcutsHelp);
  document
    .getElementById('closeShortcutsHelp')
    .addEventListener('click', hideShortcutsHelp);

  // Add event listeners for new buttons
  document
    .getElementById('batchBtn')
    .addEventListener('click', showBatchOperations);
  document
    .getElementById('advancedSearchBtn')
    .addEventListener('click', showAdvancedSearch);
  document.getElementById('statsBtn').addEventListener('click', showStatistics);
  document.getElementById('importBtn').addEventListener('click', importLibrary);
  document
    .getElementById('exportJsonBtn')
    .addEventListener('click', exportLibraryAction);
  document
    .getElementById('exportCsvBtn')
    .addEventListener('click', exportAsCSV);
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (!state.settings.keyboardShortcuts) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') {
      if (elements.editorModal.classList.contains('active')) {
        closeEditor();
      } else {
        hideShortcutsHelp();
      }
      return;
    }

    // Don't intercept typing in inputs
    if (isInput) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'k':
          e.preventDefault();
          toggleQuickSearch();
          break;
        case 'n':
          e.preventDefault();
          handleAddBook();
          break;
        case 'e':
          e.preventDefault();
          exportLibraryAction();
          break;
        case 'f':
          e.preventDefault();
          toggleQuickSearch();
          break;
        case 'd':
          e.preventDefault();
          setTheme(state.settings.theme === 'dark' ? 'light' : 'dark');
          break;
        case 's':
          e.preventDefault();
          if (state.currentEditingBook) saveEditor();
          break;
      }
    }

    if (
      e.key === 'Delete' &&
      state.selectMode &&
      state.selectedBooks.size > 0
    ) {
      batchDelete();
    }
  });
}

// ===== QUICK SEARCH =====
function toggleQuickSearch() {
  const input = document.getElementById('quickSearchInput');
  if (!input) return;
  const isVisible = input.style.display !== 'none';
  input.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    input.focus();
  } else {
    input.value = '';
    state.searchQuery = '';
    renderBooks();
  }
}

function setupQuickSearch() {
  const input = document.getElementById('quickSearchInput');
  const btn = document.getElementById('quickSearchBtn');
  if (!input || !btn) return;

  btn.addEventListener('click', toggleQuickSearch);

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = input.value.trim().toLowerCase();
      renderBooks();
    }, 200);
  });
}

// ===== SHORTCUTS HELP =====
function showShortcutsHelp() {
  const el = document.getElementById('shortcutsHelp');
  if (el) el.classList.add('active');
}

function hideShortcutsHelp() {
  const el = document.getElementById('shortcutsHelp');
  if (el) el.classList.remove('active');
}

// ===== SORT =====
function setupSortDropdown() {
  const dropdown = document.getElementById('sortDropdown');
  if (!dropdown) return;
  dropdown.querySelectorAll('.sort-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const sortBy = opt.dataset.sort;
      if (state.settings.sortBy === sortBy) {
        state.settings.sortOrder =
          state.settings.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.settings.sortBy = sortBy;
        state.settings.sortOrder = 'asc';
      }
      updateSortUI();
      renderBooks();
      saveAppState();
      dropdown.classList.remove('active');
    });
  });
}

function updateSortUI() {
  const dropdown = document.getElementById('sortDropdown');
  if (!dropdown) return;
  dropdown.querySelectorAll('.sort-option').forEach((opt) => {
    const isActive = opt.dataset.sort === state.settings.sortBy;
    opt.classList.toggle('active', isActive);
    const dir = opt.querySelector('.sort-direction');
    if (dir) {
      dir.textContent = isActive
        ? state.settings.sortOrder === 'asc'
          ? '↑'
          : '↓'
        : '↕';
    }
  });
}

function sortBooks(books) {
  const { sortBy, sortOrder } = state.settings;
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...books].sort((a, b) => {
    let aVal = a[sortBy] ?? '';
    let bVal = b[sortBy] ?? '';
    if (sortBy === 'progress') {
      return (Number(aVal) - Number(bVal)) * dir;
    }
    if (sortBy === 'addedDate') {
      return (new Date(aVal) - new Date(bVal)) * dir;
    }
    return String(aVal).localeCompare(String(bVal)) * dir;
  });
}

// ===== STATS BAR =====
function updateStatsBar() {
  const total = document.getElementById('totalBooks');
  const reading = document.getElementById('readingCount');
  const finished = document.getElementById('finishedCount');
  if (total) total.textContent = state.books.length;
  if (reading)
    reading.textContent = state.books.filter(
      (b) => b.status === 'reading'
    ).length;
  if (finished)
    finished.textContent = state.books.filter(
      (b) => b.status === 'finished'
    ).length;
}

// Ensure batch functions are globally accessible for inline onclick handlers
window.batchClearMetadata = batchClearMetadata;
window.batchUpdateCovers = batchUpdateCovers;
window.findDuplicates = findDuplicates;
window.exportAsCSV = exportAsCSV;
window.exportAsJSON = exportLibraryAction;
window.showBatchOperations = showBatchOperations;
window.showAdvancedSearch = showAdvancedSearch;
window.showStatistics = showStatistics;
window.importLibrary = importLibrary;
window.batchDelete = batchDelete;
window.organizeBySeries = () => {
  showToast('Organizing by series coming soon!');
};

// ===== TAB MANAGEMENT =====
function switchTab(tabName) {
  state.activeTab = tabName;
  updateTabDisplay();
  // saveAppState not needed for temp tab switch usually, but ok if desired
}

function updateTabDisplay() {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.activeTab);
  });

  elements.libraryTab.classList.toggle('active', state.activeTab === 'library');
  elements.searchTab.classList.toggle('active', state.activeTab === 'search');
  elements.settingsTab.classList.toggle(
    'active',
    state.activeTab === 'settings'
  );
}

// ===== FILTER MANAGEMENT =====
function setFilter(format) {
  state.filterFormat = format;
  updateFilterDisplay();
  renderBooks();
}

function updateFilterDisplay() {
  elements.filterChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.format === state.filterFormat);
  });
}

// ===== BOOK MANAGEMENT =====
async function handleAddBook() {
  const importMode = await showImportOptionsDialog();
  if (!importMode) return;

  if (importMode === 'single') {
    const files = await pickFromFiles();
    if (files.length) {
      await processFilesAsSeparateBooks(files);
    }
  } else if (importMode === 'multi') {
    // pickFolder returns grouped books if it can, or we group them
    const folderEntries = await pickFolder();
    if (folderEntries.length) {
      // Adapt folder entries to expected format if necessary
      // The pickFolder from fileSources.js returns objects with {name, source, format, parts?, uri?, file?}
      await processImportedEntries(folderEntries);
    }
  }
}

async function processImportedEntries(entries) {
  if (state.processing) {
    showToast('Please wait for current processing to complete', 'warning');
    return;
  }
  state.processing = true;
  showToast('Processing files...', 'info');

  try {
    const newBooks = [];
    for (const entry of entries) {
      if (entry.format === 'audiobook-folder' && entry.parts) {
        // Multi-part audiobook
        // Logic to combine or keep separate
        const shouldCombine = await askCombineOption(entry);
        if (shouldCombine) {
          const combined = await combineAudioBookEntry(entry);
          if (combined) newBooks.push(combined);
        } else {
          // Treat parts as individual files
          for (const part of entry.parts) {
            const book = await createBookFromSource(part);
            newBooks.push(book);
          }
        }
      } else {
        // Single file
        const book = await createBookFromSource(entry);
        newBooks.push(book);
      }
    }

    state.books.unshift(...newBooks);
    renderBooks();
    await saveAppState();
    showToast(
      `Added ${newBooks.length} book${newBooks.length !== 1 ? 's' : ''}`,
      'success'
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    showToast('Error processing files', 'error');
  } finally {
    state.processing = false;
  }
}

async function createBookFromSource(source) {
  // source: { uri, name, format, file?, blob? }
  // extractMetadata expects a File or Blob usually, or we can fetch the URI
  let fileOrBlob = source.file || source.blob;
  if (!fileOrBlob && source.uri) {
    try {
      const r = await fetch(source.uri);
      fileOrBlob = await r.blob();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch blob for', source.name);
    }
  }

  if (!fileOrBlob) {
    // Fallback or error
    return createBasicBook(source.name, source.format);
  }

  const metadata = await extractMetadata(fileOrBlob, source.name);

  // Apply filename parsing heuristics if metadata is missing key fields
  if (!metadata.title || !metadata.author || metadata.title === source.name) {
    const parsed = parseFileName(source.name);
    if (!metadata.title || metadata.title === source.name)
      metadata.title = parsed.title || source.name;
    if (!metadata.author) metadata.author = parsed.author;
    if (!metadata.series) metadata.series = parsed.series;
    if (!metadata.year) metadata.year = parsed.year;
  }

  // Add internal ID and default fields
  return {
    ...metadata,
    id: generateId(),
    addedDate: new Date().toISOString(),
    status: 'unread',
    progress: 0,
    currentPage: '',
    startDate: '',
    finishDate: '',
    notes: '',
    sourceUri: source.uri, // Keep reference if needed
  };
}

function createBasicBook(fileName, format) {
  return {
    id: generateId(),
    title: fileName,
    author: '',
    format: format,
    fileName: fileName,
    addedDate: new Date().toISOString(),
    status: 'unread',
    progress: 0,
  };
}

async function processFilesAsSeparateBooks(files) {
  // files array from pickFromFiles (which returns simplified objects)
  // Actually pickFromFiles returns [{uri, name, format, source, file?}]
  // We can reuse processImportedEntries
  await processImportedEntries(files);
}

// ===== UI HELPERS =====
async function showImportOptionsDialog() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop'; // Reuse or create style
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8); display: flex; align-items: center;
      justify-content: center; z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: var(--spacing-lg);
      max-width: 400px; width: 90%;
    `;

    dialog.innerHTML = `
      <h3 style="margin-bottom: var(--spacing-md); color: var(--text-primary);">Import Books</h3>
      <p style="margin-bottom: var(--spacing-lg); color: var(--text-secondary);">
        How would you like to import your files?
      </p>
      <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
        <button class="btn btn-primary" id="singleImportBtn">
          📁 Single Files (Separate Books)
        </button>
        <button class="btn" id="multiImportBtn">
          📚 Folder / Audiobook
        </button>
        <button class="btn" id="cancelImportBtn" style="background: var(--surface-elevated);">
          Cancel
        </button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const cleanup = () => document.body.removeChild(modal);

    document.getElementById('singleImportBtn').onclick = () => {
      cleanup();
      resolve('single');
    };
    document.getElementById('multiImportBtn').onclick = () => {
      cleanup();
      resolve('multi');
    };
    document.getElementById('cancelImportBtn').onclick = () => {
      cleanup();
      resolve(null);
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    };
  });
}

async function askCombineOption(bookGroup) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop'; // Reuse or create style
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
      `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-lg); padding: var(--spacing-lg);
        max-width: 450px; width: 90%;
      `;

    const fileCount = bookGroup.parts ? bookGroup.parts.length : 0;

    dialog.innerHTML = `
        <h3 style="margin-bottom: var(--spacing-md); color: var(--text-primary);">Multi-Part Book Detected</h3>
        <div style="margin-bottom: var(--spacing-md); color: var(--text-secondary);">
          <p><strong>${escapeHtml(bookGroup.name)}</strong></p>
          <p>Found ${fileCount} audio files.</p>
          <p>Would you like to merge them into a single file (FFmpeg) or import as separate tracks?</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          <button class="btn btn-primary" id="combineBtn">
            🔗 Merge into Single File
          </button>
          <button class="btn" id="separateBtn">
            📁 Keep as Separate Files
          </button>
          <button class="btn" id="cancelBtn" style="background: var(--surface-elevated);">
            Cancel
          </button>
        </div>
      `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const cleanup = () => document.body.removeChild(modal);

    document.getElementById('combineBtn').onclick = () => {
      cleanup();
      resolve(true);
    };
    document.getElementById('separateBtn').onclick = () => {
      cleanup();
      resolve(false);
    };
    document.getElementById('cancelBtn').onclick = () => {
      cleanup();
      resolve(null);
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    };
  });
}

async function combineAudioBookEntry(entry) {
  showToast(`Preparing to merge ${entry.parts.length} files...`, 'info');

  try {
    // 1. Resolve all parts to Files/Blobs
    const files = [];
    for (const part of entry.parts) {
      if (part.file) {
        files.push(part.file);
      } else if (part.uri) {
        // Fetch from URI if file object is missing (e.g. from capacitor picker?)
        // Note: For large files, fetching all into memory might be heavy.
        // But FFmpeg worker needs them in memory/FS anyway.
        try {
          const r = await fetch(part.uri);
          const blob = await r.blob();
          // Mock file name from part.name
          files.push(
            new File([blob], part.name, { type: blob.type || 'audio/mp3' })
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch part', part.name, e);
          throw new Error(`Failed to load ${part.name}`);
        }
      } else {
        throw new Error(`Missing source for ${part.name}`);
      }
    }

    // 2. Combine using FFmpeg worker
    // We'll update toast with progress
    const onProgress = (pct) => {
      if (pct % 10 === 0) showToast(`Merging... ${pct}%`, 'info');
    };

    const combinedFile = await combineAudioFiles(files, entry.name, onProgress);

    // 3. Create book from the combined file
    const baseBook = await createBookFromSource({
      file: combinedFile,
      name: combinedFile.name,
      format: 'm4b',
    });

    // 4. Enhance metadata from parts
    // Calculate total duration from parts if header is missing it (m4b merge usually keeps it but verify)
    // Also we can set the title from the folder name
    baseBook.title = entry.name;
    baseBook.combined = true;
    baseBook.partsCount = files.length;

    // If the first part had metadata, createBookFromSource extracted it.
    // We might want to sum durations if extractMetadata on the combined file failed or returns 0.
    if (!baseBook.duration) {
      // We'd need to extract duration from each part, which is expensive.
      // Rely on FFmpeg output for now.
    }

    showToast('Merge complete!', 'success');
    return baseBook;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Merge failed', e);
    showToast(`Merge failed: ${e.message}`, 'error');
    return null;
  }
}

// ===== UI RENDERING =====
function renderBooks() {
  if (!elements.bookGrid || !elements.emptyState) return;

  let filteredBooks =
    state.filterFormat === 'all'
      ? state.books
      : state.books.filter((book) => {
          if (state.filterFormat === 'audiobook-folder') {
            return book.format === 'audiobook-folder';
          }
          return book.format === state.filterFormat;
        });

  // Apply quick search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filteredBooks = filteredBooks.filter(
      (book) =>
        (book.title || '').toLowerCase().includes(q) ||
        (book.author || '').toLowerCase().includes(q) ||
        (book.series || '').toLowerCase().includes(q)
    );
  }

  // Apply sort
  filteredBooks = sortBooks(filteredBooks);

  // Update stats bar
  updateStatsBar();

  elements.bookGrid.innerHTML = '';
  elements.emptyState.style.display =
    filteredBooks.length === 0 ? 'block' : 'none';

  // Apply grid size class
  elements.bookGrid.className = 'book-grid';
  if (state.settings.gridSize) {
    elements.bookGrid.classList.add(`grid-${state.settings.gridSize}`);
  }
  if (state.settings.compactView) {
    elements.bookGrid.classList.add('compact');
  }

  filteredBooks.forEach((book, index) => {
    const card = createBookCard(book, index);
    elements.bookGrid.appendChild(card);
  });
}

function createBookCard(book, index) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.dataset.bookId = book.id;
  card.style.animationDelay = `${index * 50}ms`;

  const coverHtml = book.coverBase64
    ? `<img src="data:${book.coverMime || 'image/jpeg'};base64,${
        book.coverBase64
      }" alt="${escapeHtml(book.title || 'Book cover')}">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
         <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
         <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
       </svg>`;

  card.innerHTML = `
    <div class="book-cover">
      ${coverHtml}
      ${
        book.progress > 0
          ? `<div class="book-progress-indicator">${book.progress}%</div>`
          : ''
      }
    </div>
    <div class="book-info">
      <div class="book-title">${escapeHtml(book.title || book.fileName)}</div>
      <div class="book-author">${escapeHtml(
        book.author || 'Unknown Author'
      )}</div>
      ${
        book.status !== 'unread'
          ? `<div class="book-status">${getStatusLabel(book.status)}</div>`
          : ''
      }
    </div>
    <div class="book-format">${(book.format || 'unknown').toUpperCase()}</div>
  `;

  // Add click handler based on mode
  card.addEventListener('click', (_e) => {
    if (state.selectMode) {
      toggleBookSelection(book.id);
    } else {
      openBook(book);
    }
  });

  // Update selection state
  if (state.selectMode) {
    card.classList.add('select-mode');
    if (state.selectedBooks.has(book.id)) {
      card.classList.add('selected');
    }
  }

  return card;
}

function getStatusLabel(status) {
  const labels = {
    unread: '📚 Unread',
    reading: '📖 Reading',
    finished: '✅ Finished',
    abandoned: '🚫 Abandoned',
  };
  return labels[status] || status;
}

// ===== EDITOR =====
function openBook(book) {
  state.currentEditingBook = book;
  populateEditor(book);
  elements.editorModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function populateEditor(book) {
  // Basic metadata
  elements.editTitle.value = book.title || '';
  elements.editAuthor.value = book.author || '';
  elements.editNarrator.value = book.narrator || '';
  elements.editSeries.value = book.series || '';
  elements.editYear.value = book.year || '';
  elements.editPublisher.value = book.publisher || '';
  elements.editGenre.value = book.genre || '';
  elements.editIsbn.value = book.isbn || '';
  elements.editLanguage.value = book.language || 'en';
  elements.editDescription.value = book.description || '';

  // Reading progress
  elements.editStatus.value = book.status || 'unread';
  elements.editProgress.value = book.progress || 0;
  elements.editCurrentPage.value = book.currentPage || '';
  elements.editStartDate.value = book.startDate || '';
  elements.editFinishDate.value = book.finishDate || '';
  elements.editNotes.value = book.notes || '';

  // Cover image
  if (book.coverBase64) {
    elements.editorCoverImg.src = `data:${
      book.coverMime || 'image/jpeg'
    };base64,${book.coverBase64}`;
    elements.editorCoverImg.style.display = 'block';
    elements.editorCoverPlaceholder.style.display = 'none';

    // Set hero background
    elements.editorHero.style.background = `linear-gradient(135deg, 
      rgba(99, 102, 241, 0.1) 0%, 
      rgba(139, 92, 246, 0.1) 100%), 
      url('data:${book.coverMime || 'image/jpeg'};base64,${
      book.coverBase64
    }') center/cover`;
  } else {
    elements.editorCoverImg.style.display = 'none';
    elements.editorCoverPlaceholder.style.display = 'flex';
    elements.editorHero.style.background = 'var(--surface)';
  }

  // Audio-specific fields
  const isAudio = [
    'mp3',
    'm4b',
    'm4a',
    'flac',
    'ogg',
    'opus',
    'audiobook-folder',
  ].includes(book.format);
  if (isAudio) {
    elements.editorAudioFields.style.display = 'block';
    elements.editDuration.value = formatDuration(book.duration);
    elements.editBitrate.value = book.bitrate ? `${book.bitrate} kbps` : '';

    // Add or update Track/Disk info if elements exist, or create them
    let trackInfoDiv = document.getElementById('editTrackInfo');
    if (!trackInfoDiv) {
      // Create container if not exists (hacky but works for now without changing HTML structure deeply)
      const parent = elements.editorAudioFields;
      trackInfoDiv = document.createElement('div');
      trackInfoDiv.id = 'editTrackInfo';
      trackInfoDiv.className = 'editor-form-row';
      trackInfoDiv.style.marginTop = 'var(--spacing-md)';
      trackInfoDiv.innerHTML = `
            <div class="editor-form-group">
                <label class="editor-label">Track</label>
                <input type="text" class="editor-input" id="editTrack" readonly>
            </div>
            <div class="editor-form-group">
                <label class="editor-label">Disk</label>
                <input type="text" class="editor-input" id="editDisk" readonly>
            </div>
        `;
      parent.appendChild(trackInfoDiv);
    }

    const trackStr = book.trackNumber
      ? `${book.trackNumber}${book.totalTracks ? '/' + book.totalTracks : ''}`
      : '-';
    const diskStr = book.diskNumber
      ? `${book.diskNumber}${book.totalDisks ? '/' + book.totalDisks : ''}`
      : '-';

    document.getElementById('editTrack').value = trackStr;
    document.getElementById('editDisk').value = diskStr;
  } else {
    elements.editorAudioFields.style.display = 'none';
  }
}

function closeEditor() {
  elements.editorModal.classList.remove('active');
  document.body.style.overflow = '';
  state.currentEditingBook = null;
  closeEditorSearch();
}

function saveEditor() {
  if (!state.currentEditingBook) return;

  const book = state.currentEditingBook;
  book.title = elements.editTitle.value;
  book.author = elements.editAuthor.value;
  book.narrator = elements.editNarrator.value;
  book.series = elements.editSeries.value;
  book.year = elements.editYear.value;
  book.publisher = elements.editPublisher.value;
  book.genre = elements.editGenre.value;
  book.isbn = elements.editIsbn.value;
  book.language = elements.editLanguage.value;
  book.description = elements.editDescription.value;

  book.status = elements.editStatus.value;
  book.progress = parseInt(elements.editProgress.value) || 0;
  book.currentPage = elements.editCurrentPage.value;
  book.startDate = elements.editStartDate.value;
  book.finishDate = elements.editFinishDate.value;
  book.notes = elements.editNotes.value;

  // Auto-update status logic
  if (book.progress === 0 && book.status !== 'unread') {
    book.status = 'unread';
  } else if (
    book.progress > 0 &&
    book.progress < 100 &&
    book.status !== 'reading' &&
    book.status !== 'abandoned'
  ) {
    book.status = 'reading';
  } else if (book.progress === 100 && book.status !== 'finished') {
    book.status = 'finished';
    if (!book.finishDate) {
      book.finishDate = new Date().toISOString().split('T')[0];
    }
  }

  const index = state.books.findIndex((b) => b.id === book.id);
  if (index !== -1) {
    state.books[index] = book;
  }

  renderBooks();
  saveAppState();
  closeEditor();
  showToast('Metadata saved successfully', 'success');
}

// ===== SEARCH IN EDITOR =====
async function searchInEditor() {
  if (!state.currentEditingBook) return;

  const query =
    `${elements.editTitle.value} ${elements.editAuthor.value}`.trim();
  if (!query) {
    showToast('Enter a title or author to search', 'warning');
    return;
  }

  elements.editorSearchResults.style.display = 'block';
  elements.editorSearchList.innerHTML =
    '<p style="color: var(--text-secondary); padding: var(--spacing-md);">Searching...</p>';

  try {
    // Use parallel fetch
    const results = await Promise.allSettled([
      fetchGoogleBooks(query),
      fetchOpenLibrary(query),
      fetchItunes(query),
      fetchMusicBrainz(query),
    ]);

    // Flatten results
    const flatResults = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    renderEditorSearchResults(flatResults);
  } catch (error) {
    elements.editorSearchList.innerHTML =
      '<p style="color: var(--error); padding: var(--spacing-md);">Search failed. Please try again.</p>';
  }
}

function renderEditorSearchResults(results) {
  if (results.length === 0) {
    elements.editorSearchList.innerHTML =
      '<p style="color: var(--text-secondary); padding: var(--spacing-md);">No results found.</p>';
    return;
  }

  // Store results in a temporary array — avoids embedding JSON in HTML attributes (XSS risk)
  state._editorSearchResults = results;

  const html = results
    .map(
      (result, idx) => `
    <div class="editor-search-item" data-index="${idx}">
      <div class="editor-search-item-cover">
        ${
          result.coverUrl
            ? `<img src="${escapeHtml(result.coverUrl)}" alt="${escapeHtml(
                result.title
              )}">`
            : ''
        }
      </div>
      <div class="editor-search-item-info">
        <div class="editor-search-item-title">${escapeHtml(result.title)}</div>
        <div class="editor-search-item-author">${escapeHtml(
          result.author || 'Unknown Author'
        )}</div>
        <div style="font-size: 0.7em; color: var(--text-muted)">${escapeHtml(
          result.source || ''
        )}</div>
      </div>
    </div>
  `
    )
    .join('');

  elements.editorSearchList.innerHTML = html;

  // Add click listeners — look up result by index
  elements.editorSearchList
    .querySelectorAll('.editor-search-item')
    .forEach((el) => {
      el.addEventListener('click', () => {
        const result = state._editorSearchResults[Number(el.dataset.index)];
        if (result) applyEditorSearchResult(result);
      });
    });
}

async function applyEditorSearchResult(result) {
  const book = state.currentEditingBook;

  elements.editTitle.value = result.title || elements.editTitle.value;
  elements.editAuthor.value = result.author || elements.editAuthor.value;
  elements.editPublisher.value =
    result.publisher || elements.editPublisher.value;
  elements.editYear.value = result.year || elements.editYear.value;
  elements.editGenre.value = result.genre || elements.editGenre.value;
  elements.editIsbn.value = result.isbn || elements.editIsbn.value;
  elements.editDescription.value =
    result.description || elements.editDescription.value;

  // Try to apply narrator if available (mostly from iTunes)
  if (result.narrator) {
    elements.editNarrator.value = result.narrator;
  }

  // Fetch cover
  if (result.coverUrl) {
    try {
      const resp = await fetch(result.coverUrl);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result;
        book.coverBase64 = base64.split(',')[1];
        book.coverMime = blob.type;

        elements.editorCoverImg.src = base64;
        elements.editorCoverImg.style.display = 'block';
        elements.editorCoverPlaceholder.style.display = 'none';
        elements.editorHero.style.background = `linear-gradient(135deg, 
            rgba(99, 102, 241, 0.1) 0%, 
            rgba(139, 92, 246, 0.1) 100%), 
            url('${base64}') center/cover`;
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch cover', e);
    }
  }

  closeEditorSearch();
  showToast('Metadata applied', 'success');
}

function closeEditorSearch() {
  elements.editorSearchResults.style.display = 'none';
  elements.editorSearchList.innerHTML = '';
}

// ===== UTILS =====
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: var(--surface); color: var(--text-primary);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md); border: 1px solid var(--border);
    box-shadow: var(--shadow-lg); z-index: 10000;
    animation: slideUp 0.3s ease-out;
  `;
  if (type === 'error') toast.style.borderColor = 'var(--error)';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
}

// ===== THEME =====
function setTheme(theme) {
  state.settings.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeUI();
  saveAppState();
  showToast(`Switched to ${theme} theme`, 'success');
}

function updateThemeUI() {
  const theme = state.settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  elements.lightThemeBtn.classList.toggle('active', theme === 'light');
  elements.darkThemeBtn.classList.toggle('active', theme === 'dark');
}

// ===== EXPORT/BATCH =====
function exportLibraryAction() {
  exportBooks(state.books);
}

function exportSelected() {
  const selected = state.books.filter((b) => state.selectedBooks.has(b.id));
  exportBooks(selected);
}

function exportBooks(books) {
  if (!books.length) {
    showToast('No books to export', 'warning');
    return;
  }

  const format = state.settings.exportFormat;
  if (format === 'csv') {
    return exportBooksAsCSV(books);
  }

  const data = JSON.stringify(books, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  downloadBlobFile(
    blob,
    `library-${new Date().toISOString().split('T')[0]}.json`
  );
  showToast(`Exported ${books.length} books`, 'success');
}

function exportBooksAsCSV(books) {
  const headers = [
    'title',
    'author',
    'narrator',
    'series',
    'year',
    'publisher',
    'genre',
    'isbn',
    'language',
    'format',
    'status',
    'progress',
    'addedDate',
  ];
  const csvRows = [headers.join(',')];
  for (const book of books) {
    const row = headers.map((h) => {
      const val = String(book[h] ?? '').replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(row.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlobFile(
    blob,
    `library-${new Date().toISOString().split('T')[0]}.csv`
  );
  showToast(`Exported ${books.length} books as CSV`, 'success');
}

function exportAsCSV() {
  exportBooksAsCSV(state.books);
}

function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function clearLibraryAction() {
  if (confirm('Clear entire library?')) {
    state.books = [];
    state.selectedBooks.clear();
    renderBooks();
    saveAppState();
  }
}

// Batch placeholders
function toggleSelectMode() {
  state.selectMode = !state.selectMode;
  if (state.selectMode) {
    elements.selectModeBtn.classList.add('active');
    elements.selectModeBtn.textContent = 'Cancel';
    elements.batchActions.style.display = 'flex';
  } else {
    exitSelectMode();
  }
  renderBooks();
}

function exitSelectMode() {
  state.selectMode = false;
  state.selectedBooks.clear();
  elements.selectModeBtn.classList.remove('active');
  elements.selectModeBtn.textContent = 'Select';
  elements.batchActions.style.display = 'none';
  renderBooks();
}

function toggleBookSelection(id) {
  if (state.selectedBooks.has(id)) state.selectedBooks.delete(id);
  else state.selectedBooks.add(id);
  elements.selectedCount.textContent = state.selectedBooks.size;
  renderBooks(); // re-render to show selection
}

function batchEdit() {
  showToast('Batch metadata editing coming soon!');
}
function batchExport() {
  exportSelected();
}

async function batchClearMetadata() {
  if (state.selectedBooks.size === 0) {
    showToast('No books selected', 'warning');
    return;
  }
  if (!confirm(`Clear metadata for ${state.selectedBooks.size} books?`)) return;

  state.books.forEach((book) => {
    if (state.selectedBooks.has(book.id)) {
      book.author = '';
      book.narrator = '';
      book.series = '';
      book.year = '';
      book.publisher = '';
      book.genre = '';
      book.isbn = '';
      book.description = '';
    }
  });

  renderBooks();
  await saveAppState();
  showToast('Metadata cleared', 'success');
}

async function batchUpdateCovers() {
  if (state.selectedBooks.size === 0) {
    showToast('No books selected', 'warning');
    return;
  }
  showToast('Updating covers...', 'info');
  let updated = 0;

  for (const book of state.books) {
    if (state.selectedBooks.has(book.id) && !book.coverBase64 && book.title) {
      try {
        const results = await Promise.allSettled([
          fetchGoogleBooks(book.title),
          fetchItunes(book.title),
        ]);
        const flat = results
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value);
        if (flat.length > 0 && flat[0].coverUrl) {
          const response = await fetch(flat[0].coverUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = () => {
              book.coverBase64 = reader.result.split(',')[1];
              book.coverMime = blob.type;
              updated++;
              resolve();
            };
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Cover update failed for', book.title);
      }
    }
  }

  renderBooks();
  await saveAppState();
  showToast(`Updated ${updated} covers`, 'success');
}

function findDuplicates() {
  const duplicates = [];
  const seen = new Map();

  state.books.forEach((book) => {
    const key = `${book.title.toLowerCase()}-${
      book.author?.toLowerCase() || ''
    }`;
    if (seen.has(key)) {
      duplicates.push(book);
    } else {
      seen.set(key, book);
    }
  });

  if (duplicates.length === 0) {
    showToast('No duplicates found', 'info');
  } else {
    if (
      confirm(`Found ${duplicates.length} potential duplicates. Select them?`)
    ) {
      state.selectMode = true;
      state.selectedBooks.clear();
      duplicates.forEach((b) => state.selectedBooks.add(b.id));
      elements.selectModeBtn.classList.add('active');
      elements.selectModeBtn.textContent = 'Cancel';
      elements.batchActions.style.display = 'flex';
      elements.selectedCount.textContent = state.selectedBooks.size;
      renderBooks();
    }
  }
}

function batchDelete() {
  if (state.selectedBooks.size === 0) {
    showToast('No books selected', 'warning');
    return;
  }
  if (confirm(`Delete ${state.selectedBooks.size} books?`)) {
    state.books = state.books.filter((b) => !state.selectedBooks.has(b.id));
    exitSelectMode();
    saveAppState();
    showToast('Books deleted', 'success');
  }
}

// Sort/Grid
function toggleSortDropdown() {
  const d = document.getElementById('sortDropdown');
  d.classList.toggle('active');
}
function cycleGridSize() {
  const sizes = ['small', 'medium', 'large'];
  const curr = state.settings.gridSize || 'medium';
  state.settings.gridSize = sizes[(sizes.indexOf(curr) + 1) % sizes.length];
  saveAppState();
  renderBooks();
}
function toggleViewMode() {
  state.settings.compactView = !state.settings.compactView;
  saveAppState();
  renderBooks();
}
function showBatchOperations() {
  const modal = createBatchModal();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function createBatchModal() {
  const modal = document.createElement('div');
  modal.className = 'batch-modal';
  modal.innerHTML = `
        <div class="modal-backdrop" onclick="window.closeBatchModal(this)"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Batch Operations</h2>
                <button class="btn btn-icon" onclick="window.closeBatchModal(this)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="batch-section">
                    <h3>Metadata Operations</h3>
                    <button class="btn" onclick="window.batchUpdateCovers()">Update Selected Covers</button>
                    <button class="btn" onclick="window.batchClearMetadata()" style="color: var(--error); border-color: var(--error);">Clear Selected Metadata</button>
                </div>
                <div class="batch-section">
                    <h3>Library Management</h3>
                    <button class="btn" onclick="window.findDuplicates()">Find Duplicates</button>
                    <button class="btn" onclick="window.organizeBySeries()">Organize by Series</button>
                    <button class="btn" onclick="window.batchDelete()" style="color: var(--error); border-color: var(--error);">Delete Selected</button>
                </div>
            </div>
        </div>
    `;
  return modal;
}

window.closeBatchModal = function (element) {
  const modal = element.closest('.batch-modal');
  modal.classList.remove('show');
  setTimeout(() => modal.remove(), 300);
};

function showAdvancedSearch() {
  const modal = createAdvancedSearchModal();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function createAdvancedSearchModal() {
  const modal = document.createElement('div');
  modal.className = 'search-modal';
  modal.innerHTML = `
        <div class="modal-backdrop" onclick="window.closeSearchModal(this)"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Advanced Search</h2>
                <button class="btn btn-icon" onclick="window.closeSearchModal(this)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="search-form">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="search-title" placeholder="Search in titles...">
                    </div>
                    <div class="form-group">
                        <label>Author</label>
                        <input type="text" id="search-author" placeholder="Search in authors...">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Format</label>
                            <select id="search-format">
                                <option value="">All Formats</option>
                                <option value="epub">EPUB</option>
                                <option value="pdf">PDF</option>
                                <option value="mp3">MP3</option>
                                <option value="m4b">M4B</option>
                                <option value="audiobook-folder">Audiobook Folder</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Year</label>
                            <input type="number" id="search-year" placeholder="Year">
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="window.closeSearchModal(this)">Cancel</button>
                <button class="btn btn-primary" onclick="window.performAdvancedSearch()">Search</button>
            </div>
        </div>
    `;
  return modal;
}

window.closeSearchModal = function (element) {
  const modal = element.closest('.search-modal');
  modal.classList.remove('show');
  setTimeout(() => modal.remove(), 300);
};

window.performAdvancedSearch = function () {
  const title = document.getElementById('search-title').value.toLowerCase();
  const author = document.getElementById('search-author').value.toLowerCase();
  const format = document.getElementById('search-format').value;
  const year = document.getElementById('search-year').value;

  const results = state.books.filter((book) => {
    if (title && !book.title.toLowerCase().includes(title)) return false;
    if (author && !book.author?.toLowerCase().includes(author)) return false;
    if (format && book.format !== format) return false;
    if (year && book.year !== year) return false;
    return true;
  });

  window.closeSearchModal(document.querySelector('.search-modal .btn'));

  if (results.length === 0) {
    showToast('No books match your criteria', 'info');
  } else {
    showToast(`Found ${results.length} matching books`, 'success');
    // Filter view temporarily
    const originalBooks = state.books;
    state.books = results;
    renderBooks();

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = 'Reset Filter';
    resetBtn.style.margin = 'var(--spacing-md)';
    resetBtn.onclick = () => {
      state.books = originalBooks;
      renderBooks();
      resetBtn.remove();
    };
    elements.bookGrid.parentNode.insertBefore(resetBtn, elements.bookGrid);
  }
};

function showStatistics() {
  const stats = calculateStatistics();
  const modal = createStatsModal(stats);
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function calculateStatistics() {
  const total = state.books.length;
  const withCovers = state.books.filter((b) => b.coverBase64).length;
  const audiobooks = state.books.filter((b) =>
    ['mp3', 'm4b', 'm4a', 'flac', 'ogg', 'opus', 'audiobook-folder'].includes(
      b.format
    )
  ).length;
  const withMetadata = state.books.filter(
    (b) => b.author && b.description
  ).length;

  return {
    total,
    withCovers,
    audiobooks,
    completionRate: total ? Math.round((withMetadata / total) * 100) : 0,
  };
}

function createStatsModal(stats) {
  const modal = document.createElement('div');
  modal.className = 'stats-modal';
  modal.innerHTML = `
        <div class="modal-backdrop" onclick="window.closeStatsModal(this)"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Library Statistics</h2>
                <button class="btn btn-icon" onclick="window.closeStatsModal(this)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${stats.total}</h3>
                        <p>Total Books</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.withCovers}</h3>
                        <p>With Covers</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.audiobooks}</h3>
                        <p>Audiobooks</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.completionRate}%</h3>
                        <p>Metadata Complete</p>
                    </div>
                </div>
            </div>
        </div>
    `;
  return modal;
}

window.closeStatsModal = function (element) {
  const modal = element.closest('.stats-modal');
  modal.classList.remove('show');
  setTimeout(() => modal.remove(), 300);
};

async function importLibrary() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          state.books = [...state.books, ...imported];
          renderBooks();
          await saveAppState();
          showToast(`Imported ${imported.length} books`, 'success');
        } else {
          showToast('Invalid file format', 'error');
        }
      } catch (err) {
        showToast('Import failed', 'error');
      }
    }
  };
  input.click();
}

// Search tab logic
async function performSearch() {
  const query = elements.searchInput.value.trim();
  if (!query) return;

  elements.searchResults.innerHTML =
    '<p style="color: var(--text-secondary); padding: var(--spacing-md);">Searching...</p>';
  try {
    const results = await Promise.allSettled([
      fetchGoogleBooks(query),
      fetchOpenLibrary(query),
      fetchItunes(query),
      fetchMusicBrainz(query),
    ]);

    const flatResults = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    if (!flatResults.length) {
      elements.searchResults.innerHTML =
        '<p style="color: var(--text-secondary); padding: var(--spacing-md);">No results found.</p>';
      return;
    }

    elements.searchResults.innerHTML = flatResults
      .map(
        (result, index) => `
            <div class="editor-search-item" style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-sm); cursor: default;">
                <div class="editor-search-item-cover">
                    ${
                      result.coverUrl
                        ? `<img src="${result.coverUrl}" alt="${escapeHtml(
                            result.title
                          )}">`
                        : ''
                    }
                </div>
                <div class="editor-search-item-info">
                    <div class="editor-search-item-title" style="font-size: 1.1rem; font-weight: 700;">${escapeHtml(
                      result.title
                    )}</div>
                    <div class="editor-search-item-author" style="color: var(--text-secondary);">${escapeHtml(
                      result.author || 'Unknown Author'
                    )}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: var(--spacing-xs);">
                        ${result.year ? result.year + ' • ' : ''}${
          result.source
        }
                    </div>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-sm);" data-index="${index}">
                        Create Entry from Metadata
                    </button>
                </div>
            </div>
        `
      )
      .join('');

    // Add event listeners to the new buttons
    elements.searchResults
      .querySelectorAll('button.btn-primary')
      .forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          const metadata = flatResults[idx];
          await createBookFromMetadata(metadata);
        });
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Search failed', e);
    elements.searchResults.innerHTML =
      '<p style="color: var(--error); padding: var(--spacing-md);">Error searching. Please try again.</p>';
  }
}

async function createBookFromMetadata(metadata) {
  showToast('Creating book entry...', 'info');

  const book = {
    id: generateId(),
    title: metadata.title,
    author: metadata.author,
    narrator: metadata.narrator || '',
    publisher: metadata.publisher || '',
    year: metadata.year || '',
    genre: metadata.genre || '',
    isbn: metadata.isbn || '',
    description: metadata.description || '',
    language: metadata.language || 'en',
    format: 'manual', // Indicates no source file yet
    addedDate: new Date().toISOString(),
    status: 'unread',
    progress: 0,
    notes: '',
    coverBase64: null,
    coverMime: null,
  };

  // Fetch cover if URL present
  if (metadata.coverUrl) {
    try {
      const resp = await fetch(metadata.coverUrl);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        book.coverBase64 = reader.result.split(',')[1];
        book.coverMime = blob.type;
        state.books.unshift(book);
        renderBooks();
        await saveAppState();
        showToast(`Created entry for "${book.title}"`, 'success');
        switchTab('library');
      };
      reader.readAsDataURL(blob);
      return; // Exit and let reader finish
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch cover during import', e);
    }
  }

  state.books.unshift(book);
  renderBooks();
  await saveAppState();
  showToast(`Created entry for "${book.title}"`, 'success');
  switchTab('library');
}

function handleCoverUpload(e) {
  if (e.target.files[0] && state.currentEditingBook) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      state.currentEditingBook.coverBase64 = reader.result.split(',')[1];
      state.currentEditingBook.coverMime = file.type;
      populateEditor(state.currentEditingBook);
    };
    reader.readAsDataURL(file);
  }
}
