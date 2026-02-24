/**
 * ios-app/js/app.js
 * Full mobile app logic — tabs, sheets, editor, library, file sources.
 */

import { fetchAll } from '../../src/apis/index.js';
import { extractMetadata } from '../../src/extractors/index.js';

// ─── Capacitor Plugins (graceful fallback in browser) ────────────────────────
let Haptics, HapticsImpactStyle;
try {
  const h = await import('@capacitor/haptics');
  Haptics  = h.Haptics;
  HapticsImpactStyle = h.ImpactStyle;
} catch { Haptics = null; }

async function haptic(style = 'Medium') {
  if (!Haptics) return;
  try { await Haptics.impact({ style: HapticsImpactStyle?.[style] || style }); } catch {}
}

// Preferences shim
let prefs;
try {
  const p = await import('@capacitor/preferences');
  prefs = p.Preferences;
} catch {
  prefs = {
    get:  async ({ key }) => ({ value: localStorage.getItem(key) }),
    set:  async ({ key, value }) => localStorage.setItem(key, value),
  };
}

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  library:         [],   // Array of book entries
  activeBookIndex: -1,   // Which book is open in editor
  activeTab:       'Library',
  filterFmt:       'all',
  settings: {
    googleDriveClientId: '',
    autoFetch: true,
  },
};

// ─── Persist ──────────────────────────────────────────────────────────────────
async function persistLibrary() {
  const slim = state.library.map(b => ({ ...b, coverBase64: null, coverMime: null }));
  await prefs.set({ key: 'library_v2', value: JSON.stringify(slim) });
}

async function loadPersistedData() {
  try {
    const { value: libVal } = await prefs.get({ key: 'library_v2' });
    if (libVal) state.library = JSON.parse(libVal);
  } catch {}
  try {
    const { value: sVal } = await prefs.get({ key: 'settings_v1' });
    if (sVal) state.settings = { ...state.settings, ...JSON.parse(sVal) };
  } catch {}
}

async function persistSettings() {
  await prefs.set({ key: 'settings_v1', value: JSON.stringify(state.settings) });
}

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
  // Screens
  screenLibrary:  $('screenLibrary'),
  screenSearch:   $('screenSearch'),
  screenSettings: $('screenSettings'),
  editorScreen:   $('editorScreen'),

  // Library
  bookGrid:     $('bookGrid'),
  emptyState:   $('emptyState'),
  filterStrip:  $('filterStrip'),

  // Source picker sheet
  sourcePickerBackdrop: $('sourcePickerBackdrop'),
  sourcePickerSheet:    $('sourcePickerSheet'),
  srcLocal:   $('srcLocal'),
  srcICloud:  $('srcICloud'),
  srcFolder:  $('srcFolder'),
  srcGDrive:  $('srcGDrive'),

  // Editor
  heroFormat:    $('heroFormat'),
  heroTitle:     $('heroTitle'),
  heroAuthor:    $('heroAuthor'),
  heroCover:     $('heroCover'),
  heroBg:        $('heroBg'),
  audioStrip:    $('audioStrip'),
  astDuration:   $('astDuration'),
  astBitrate:    $('astBitrate'),
  astSampleRate: $('astSampleRate'),
  astChannels:   $('astChannels'),

  // Form fields
  fTitle:    $('fTitle'),
  fAuthor:   $('fAuthor'),
  fNarrator: $('fNarrator'),
  fSeries:   $('fSeries'),
  fYear:     $('fYear'),
  fPublisher:$('fPublisher'),
  fGenre:    $('fGenre'),
  fISBN:     $('fISBN'),
  fLanguage: $('fLanguage'),
  fDescription: $('fDescription'),

  // Results sheet
  resultsBackdrop: $('resultsBackdrop'),
  resultsSheet:    $('resultsSheet'),
  resultsList:     $('resultsList'),
  resultsSheetTitle: $('resultsSheetTitle'),

  // Search tab
  globalSearchInput: $('globalSearchInput'),
  searchResultsWrap: $('searchResultsWrap'),
  btnSearchClear:    $('btnSearchClear'),

  // Settings
  settingGDriveId: $('settingGDriveId'),
  settingAutoFetch: $('settingAutoFetch'),

  // Global UI
  toast:        $('toast'),
  loadingPill:  $('loadingPill'),
  loadingMsg:   $('loadingMsg'),
  // Folder/concat UI
  folderConfirmBackdrop: $('folderConfirmBackdrop'),
  folderConfirm:         $('folderConfirm'),
  folderConfirmTitle:    $('folderConfirmTitle'),
  folderConfirmBody:     $('folderConfirmBody'),
  folderConfirmConcat:   $('folderConfirmConcat'),
  folderConfirmParts:    $('folderConfirmParts'),
  folderConfirmCancel:   $('folderConfirmCancel'),
  concatProgressBackdrop: $('concatProgressBackdrop'),
  concatProgress:         $('concatProgress'),
  concatProgressBar:      $('concatProgressBar'),
  concatProgressMsg:      $('concatProgressMsg'),
  concatCancel:           $('concatCancel'),
  partsListWrap:          $('partsListWrap'),
  partsList:              $('partsList'),
  // Generic confirm
  confirmBackdrop: $('confirmBackdrop'),
  confirmModal:    $('confirmModal'),
  confirmTitle:    $('confirmTitle'),
  confirmBody:     $('confirmBody'),
  confirmOk:       $('confirmOk'),
  confirmCancel:   $('confirmCancel'),
};

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '', ms = 3000) {
  dom.toast.textContent = msg;
  dom.toast.className = `toast${state.activeTab === 'editor' ? ' in-editor' : ''}${type ? ` ${type}` : ''}`;
  requestAnimationFrame(() => dom.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), ms);
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function showLoading(msg = 'Loading…') {
  dom.loadingMsg.textContent = msg;
  dom.loadingPill.style.display = 'flex';
}
function hideLoading() {
  dom.loadingPill.style.display = 'none';
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────
const TAB_SCREENS = { Library: 'screenLibrary', Search: 'screenSearch', Settings: 'screenSettings' };

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === state.activeTab) return;
    haptic('Light');
    switchTab(tab);
  });
});

function switchTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll('.tab-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active);
  });

  const screenId = TAB_SCREENS[tab];
  if (screenId) $( screenId)?.classList.add('active');
}

// ─── Source Picker Sheet ──────────────────────────────────────────────────────
function openSourcePicker() {
  haptic('Medium');
  dom.sourcePickerBackdrop.classList.add('visible');
  dom.sourcePickerSheet.classList.add('open');
}

function closeSourcePicker() {
  dom.sourcePickerBackdrop.classList.remove('visible');
  dom.sourcePickerSheet.classList.remove('open');
}

$('btnAddMain').addEventListener('click', openSourcePicker);
$('btnAddEmpty').addEventListener('click', openSourcePicker);
dom.sourcePickerBackdrop.addEventListener('click', closeSourcePicker);
$('btnSheetCancel').addEventListener('click', () => { haptic('Light'); closeSourcePicker(); });

// ─── File Import ──────────────────────────────────────────────────────────────

// Local + iCloud — both use the same document picker on iOS
async function importFromFilePicker() {
  closeSourcePicker();
  const { pickFromFiles } = await import('../../src/fileSources.js');
  try {
    const picked = await pickFromFiles();
    if (!picked.length) return;
    await processPickedFiles(picked);
  } catch (e) {
    toast(`Import failed: ${e.message}`, 'error');
  }
}

// Google Drive
async function importFromGoogleDrive() {
  closeSourcePicker();
  if (!state.settings.googleDriveClientId) {
    toast('Add your Google Client ID in Settings first', 'info', 5000);
    setTimeout(() => switchTab('Settings'), 800);
    return;
  }
  const { openGoogleDrivePicker } = await import('../../src/fileSources.js');
  await openGoogleDrivePicker(state.settings.googleDriveClientId);
  toast('Sign in and select your file in the browser', 'info', 5000);
}

dom.srcLocal.addEventListener('click', importFromFilePicker);
dom.srcICloud.addEventListener('click', importFromFilePicker);
dom.srcFolder.addEventListener('click', importFromFolder);
dom.srcGDrive.addEventListener('click', importFromGoogleDrive);

// Import from a folder (audiobook parts)
async function importFromFolder() {
  closeSourcePicker();
  const { pickFolder } = await import('../../src/fileSources.js');
  try {
    const picked = await pickFolder();
    if (!picked || !picked.length) return;
    showLoading('Importing folder…');
    for (const item of picked) {
      try {
        if (item.format === 'audiobook-folder' && item.parts && item.parts.length) {
          const choice = await showFolderImportConfirm(item.name, item.parts.length);
          if (choice === 'concat') {
            try {
              // show concat progress UI and allow cancellation
              const controller = createConcatController();
              showConcatProgressUI();
              const outBlob = await concatenateAudioParts(item.parts, item.name, controller);
              hideConcatProgressUI();
              const meta = await extractMetadata(outBlob, `${item.name}.m4b`);
              const entry = {
                id: Date.now() + Math.random(),
                uri: URL.createObjectURL(outBlob),
                fileName: `${item.name}.m4b`,
                format: 'm4b',
                source: 'local-folder',
                status: 'imported',
                parts: item.parts.map(p => ({ name: p.name, uri: p.uri })),
                ...meta,
              };
              state.library.push(entry);
            } catch (e) {
              hideConcatProgressUI();
              if (e && e.name === 'FFMPEG_ABORT') {
                toast('Concatenation canceled', 'info');
                const entry = makeFolderEntry(item);
                state.library.push(entry);
              } else {
                console.error('[concat]', e);
                toast('Concatenation failed; importing as multi-part', 'error');
                const entry = makeFolderEntry(item);
                state.library.push(entry);
              }
            }
          } else if (choice === 'parts') {
            const entry = makeFolderEntry(item);
            state.library.push(entry);
          } else {
            // canceled
          }
        } else {
          await processPickedFiles([item]);
        }
      } catch (e) {
        console.error('[importFolder]', e);
      }
    }
    hideLoading();
    await persistLibrary();
    renderLibrary();
    toast('Folder(s) added', 'success');
  } catch (e) {
    hideLoading();
    toast(`Folder import failed: ${e.message}`, 'error');
  }
}

function makeFolderEntry(item) {
  // Use first part to extract basic metadata when possible
  const first = item.parts[0];
  const entry = {
    id: Date.now() + Math.random(),
    uri: first?.uri || null,
    fileName: `${item.name}`,
    format: 'audiobook-folder',
    source: 'local-folder',
    status: 'imported',
    parts: item.parts.map(p => ({ name: p.name, uri: p.uri })),
    title: item.name,
  };
  return entry;
}

async function concatenateAudioParts(parts, outName, controller) {
  // parts: [{name, uri, file, format}, ...]
  // Use FFmpeg.wasm (@ffmpeg/ffmpeg). This is optional and may be heavy.
  const { createFFmpeg, fetchFile } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.8/dist/ffmpeg.min.js');
  const ffmpeg = createFFmpeg({ log: false });
  await ffmpeg.load();

  if (controller) {
    controller.setFFmpeg(ffmpeg);
    // attach progress callback
    if (typeof ffmpeg.setProgress === 'function') {
      ffmpeg.setProgress(({ ratio, time }) => {
        const pct = Math.round(ratio * 100);
        updateConcatProgress(pct, `Processing... ${pct}%`);
      });
    }
  }

  // Write each part to FS
  const listLines = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    // obtain ArrayBuffer
    let data;
    if (p.file instanceof File) data = await p.file.arrayBuffer();
    else {
      const r = await fetch(p.uri);
      data = await r.arrayBuffer();
    }
    const name = `part${i}.${p.name.split('.').pop() || 'mp3'}`;
    ffmpeg.FS('writeFile', name, await fetchFile(new Uint8Array(data)));
    listLines.push(`file '${name}'`);
  }

  // Write concat list
  ffmpeg.FS('writeFile', 'list.txt', listLines.join('\n'));

  // Output file: use m4b container with AAC audio
  const outFile = `${outName.replace(/[^a-z0-9]/gi,'_')}.m4b`;
  try {
    await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c:a', 'aac', '-b:a', '128k', outFile);
  } catch (e) {
    // If ffmpeg was aborted via controller, throw a specific error
    if (controller && controller.aborted) {
      const err = new Error('FFMPEG aborted'); err.name = 'FFMPEG_ABORT'; throw err;
    }
    throw e;
  }

  const data = ffmpeg.FS('readFile', outFile);
  const blob = new Blob([data.buffer], { type: 'audio/mp4' });
  // Clean up FS (best effort)
  try { ffmpeg.FS('unlink', 'list.txt'); } catch {}
  for (let i = 0; i < parts.length; i++) try { ffmpeg.FS('unlink', `part${i}.${parts[i].name.split('.').pop()}`); } catch {}
  try { ffmpeg.FS('unlink', outFile); } catch {}
  return blob;
}

// --- Folder import confirmation UI helpers ---
function showFolderImportConfirm(name, partCount) {
  return new Promise(res => {
    dom.folderConfirmTitle.textContent = `Import “${name}”`;
    dom.folderConfirmBody.textContent = `This folder contains ${partCount} part${partCount>1?'s':''}. Concatenate into a single file or import as parts?`;
    dom.folderConfirmBackdrop.style.display = 'block';
    dom.folderConfirm.style.display = 'block';

    const clear = () => {
      dom.folderConfirmBackdrop.style.display = 'none';
      dom.folderConfirm.style.display = 'none';
      dom.folderConfirmConcat.removeEventListener('click', onConcat);
      dom.folderConfirmParts.removeEventListener('click', onParts);
      dom.folderConfirmCancel.removeEventListener('click', onCancel);
    };
    const onConcat = () => { clear(); res('concat'); };
    const onParts  = () => { clear(); res('parts'); };
    const onCancel = () => { clear(); res('cancel'); };

    dom.folderConfirmConcat.addEventListener('click', onConcat);
    dom.folderConfirmParts.addEventListener('click', onParts);
    dom.folderConfirmCancel.addEventListener('click', onCancel);
  });
}

function showConcatProgressUI() {
  dom.concatProgressBackdrop.style.display = 'block';
  dom.concatProgress.style.display = 'block';
  dom.concatProgressBar.style.width = '0%';
  dom.concatProgressMsg.textContent = 'Starting…';
}

function hideConcatProgressUI() {
  dom.concatProgressBackdrop.style.display = 'none';
  dom.concatProgress.style.display = 'none';
}

function updateConcatProgress(pct, msg) {
  dom.concatProgressBar.style.width = `${pct}%`;
  dom.concatProgressMsg.textContent = msg || `${pct}%`;
}

function createConcatController() {
  let ffmpegInst = null;
  const controller = {
    aborted: false,
    setFFmpeg(inst) { ffmpegInst = inst; },
    abort() {
      controller.aborted = true;
      try { ffmpegInst && ffmpegInst.exit && ffmpegInst.exit(); } catch (e) {}
    }
  };

  // Wire cancel button
  const onCancel = () => { controller.abort(); };
  dom.concatCancel.addEventListener('click', onCancel, { once: true });
  return controller;
}

function createPartsListHtml(parts) {
  return parts.map((p, i) => `<div class="part-row">${i+1}. ${esc(p.name)}</div>`).join('');
}

// --- Generic confirm modal ---
function showConfirm(title, body) {
  return new Promise(res => {
    dom.confirmTitle.textContent = title || 'Confirm';
    dom.confirmBody.textContent = body || '';
    dom.confirmBackdrop.style.display = 'block';
    dom.confirmModal.style.display = 'block';

    const clear = () => {
      dom.confirmBackdrop.style.display = 'none';
      dom.confirmModal.style.display = 'none';
      dom.confirmOk.removeEventListener('click', onOk);
      dom.confirmCancel.removeEventListener('click', onCancel);
    };
    const onOk = () => { clear(); res(true); };
    const onCancel = () => { clear(); res(false); };

    dom.confirmOk.addEventListener('click', onOk);
    dom.confirmCancel.addEventListener('click', onCancel);
  });
}

// ─── Process Picked Files ─────────────────────────────────────────────────────
async function processPickedFiles(picked) {
  showLoading(`Importing ${picked.length} file${picked.length > 1 ? 's' : ''}…`);

  for (const item of picked) {
    try {
      let blob = item.file || item.blob;

      // If we only have a URI (native document picker), fetch the blob
      if (!blob && item.uri && !item.uri.startsWith('data:')) {
        const r = await fetch(item.uri);
        blob = await r.blob();
      }

      // Extract metadata
      const meta = blob
        ? await extractMetadata(blob, item.name)
        : { title: guessTitle(item.name), format: item.format, fileName: item.name };

      const entry = {
        id:       Date.now() + Math.random(),
        uri:      item.uri,
        fileName: item.name,
        format:   item.format,
        source:   item.source,
        status:   'imported',
        ...meta,
      };

      state.library.push(entry);

      // Auto-fetch from APIs
      if (state.settings.autoFetch && (entry.title || entry.author)) {
        fetchAndEnrichEntry(state.library.length - 1);
      }
    } catch (e) {
      console.error('[import]', item.name, e);
    }
  }

  hideLoading();
  await persistLibrary();
  renderLibrary();
  toast(`Added ${picked.length} book${picked.length > 1 ? 's' : ''}`, 'success');
}

// ─── Library Render ───────────────────────────────────────────────────────────
const FORMAT_LABELS = {
  epub: 'EPUB', pdf: 'PDF', mp3: 'MP3', m4b: 'M4B',
  m4a: 'M4A', flac: 'FLAC', ogg: 'OGG', opus: 'OPUS',
};

const AUDIO_FMTS = new Set(['mp3', 'm4b', 'm4a', 'flac', 'ogg', 'opus']);

function renderLibrary() {
  const filtered = state.filterFmt === 'all'
    ? state.library
    : state.library.filter(b => b.format === state.filterFmt);

  // Remove old cards, keep empty state
  dom.bookGrid.querySelectorAll('.book-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    dom.emptyState.style.display = 'flex';
    return;
  }

  dom.emptyState.style.display = 'none';
  const frag = document.createDocumentFragment();

  filtered.forEach((book, i) => {
    const realIdx = state.library.indexOf(book);
    const card    = document.createElement('div');
    card.className = 'book-card fade-up';
    card.style.animationDelay = `${Math.min(i * 40, 300)}ms`;
    card.dataset.index = realIdx;

    const gradClass = `cover-grad-${i % 6}`;
    const coverHtml = book.coverBase64
      ? `<img class="book-cover-img" src="data:${book.coverMime || 'image/jpeg'};base64,${book.coverBase64}" alt="" loading="lazy" />`
      : `<div class="book-cover-placeholder ${gradClass}">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
         </div>`;

    // Parts badge for audiobook-folder entries
    const partsBadge = (book.format === 'audiobook-folder' && Array.isArray(book.parts) && book.parts.length)
      ? `<span class="parts-badge">${book.parts.length}</span>`
      : '';

    card.innerHTML = `
      <div class="book-cover-wrap">
        ${coverHtml}
        <span class="book-fmt-badge fmt-${book.format}">${FORMAT_LABELS[book.format] || book.format.toUpperCase()}</span>
        ${partsBadge}
      </div>
      <div class="book-title">${esc(book.title || book.fileName)}</div>
      <div class="book-author">${esc(book.author || '—')}</div>`;

    card.addEventListener('click', () => { haptic('Light'); openEditor(realIdx); });
    frag.appendChild(card);
  });

  dom.bookGrid.appendChild(frag);
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────
dom.filterStrip.addEventListener('click', e => {
  const pill = e.target.closest('.filter-pill');
  if (!pill) return;
  haptic('Light');
  dom.filterStrip.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  state.filterFmt = pill.dataset.fmt;
  renderLibrary();
});

// ─── Editor ───────────────────────────────────────────────────────────────────
function openEditor(index) {
  state.activeBookIndex = index;
  const book = state.library[index];
  if (!book) return;

  populateEditor(book);
  dom.editorScreen.classList.add('open');
}

function closeEditor() {
  haptic('Light');
  dom.editorScreen.classList.remove('open');
  closeResultsSheet();
  state.activeBookIndex = -1;
}

$('btnEditorBack').addEventListener('click', closeEditor);

// Back gesture (swipe down from top)
let touchStartY = 0;
dom.editorScreen.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
dom.editorScreen.addEventListener('touchend', e => {
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (dy > 80 && touchStartY < 80) closeEditor();
}, { passive: true });

function populateEditor(book) {
  const fmtLabel = FORMAT_LABELS[book.format] || book.format?.toUpperCase() || '—';
  dom.heroFormat.textContent = fmtLabel;
  dom.heroTitle.textContent  = book.title  || book.fileName || '—';
  dom.heroAuthor.textContent = book.author || '—';

  // Cover hero
  if (book.coverBase64) {
    const src = `data:${book.coverMime || 'image/jpeg'};base64,${book.coverBase64}`;
    dom.heroCover.src   = src;
    dom.heroCover.style.display = 'block';
    dom.heroBg.style.backgroundImage = `url('${src}')`;
  } else {
    dom.heroCover.src   = '';
    dom.heroCover.style.display = 'none';
    dom.heroBg.style.backgroundImage = '';
  }

  // Audio strip
  const isAudio = AUDIO_FMTS.has(book.format);
  dom.audioStrip.style.display = isAudio ? 'flex' : 'none';
  if (isAudio) {
    dom.astDuration.textContent   = fmtDuration(book.duration);
    dom.astBitrate.textContent    = book.bitrate    ? `${book.bitrate} kbps` : '—';
    dom.astSampleRate.textContent = book.sampleRate ? `${(book.sampleRate/1000).toFixed(1)} kHz` : '—';
    dom.astChannels.textContent   = book.channels   ? (book.channels === 1 ? 'Mono' : 'Stereo') : '—';
  }

  // Form
  dom.fTitle.value       = book.title       || '';
  dom.fAuthor.value      = book.author      || '';
  dom.fNarrator.value    = book.narrator    || '';
  dom.fSeries.value      = book.series      || '';
  dom.fYear.value        = book.year        || '';
  dom.fPublisher.value   = book.publisher   || '';
  dom.fGenre.value       = book.genre       || '';
  dom.fISBN.value        = book.isbn        || '';
  dom.fLanguage.value    = book.language    || '';
  dom.fDescription.value = book.description || '';

  // Live update hero as user types
  dom.fTitle.oninput  = () => { dom.heroTitle.textContent  = dom.fTitle.value  || '—'; };
  dom.fAuthor.oninput = () => { dom.heroAuthor.textContent = dom.fAuthor.value || '—'; };
}

  // Show parts list for audiobook-folder entries
  if (book.format === 'audiobook-folder' && Array.isArray(book.parts)) {
    dom.partsListWrap.style.display = 'block';
    dom.partsList.innerHTML = createPartsListHtml(book.parts);
  } else {
    dom.partsListWrap.style.display = 'none';
    dom.partsList.innerHTML = '';
  }

function collectEditorValues() {
  const book = state.library[state.activeBookIndex] || {};
  return {
    ...book,
    title:       dom.fTitle.value,
    author:      dom.fAuthor.value,
    narrator:    dom.fNarrator.value,
    series:      dom.fSeries.value,
    year:        dom.fYear.value,
    publisher:   dom.fPublisher.value,
    genre:       dom.fGenre.value,
    isbn:        dom.fISBN.value,
    language:    dom.fLanguage.value,
    description: dom.fDescription.value,
  };
}

// Save
$('btnEditorSave').addEventListener('click', async () => {
  haptic('Medium');
  const updated = collectEditorValues();
  state.library[state.activeBookIndex] = updated;
  await persistLibrary();
  renderLibrary();
  toast('Saved!', 'success');
});

// Fetch from APIs
$('btnEditorFetch').addEventListener('click', () => {
  haptic('Medium');
  const query = dom.fTitle.value || dom.fAuthor.value;
  if (!query) { toast('Enter a title or author first', ''); return; }
  fetchAndShowResults(query);
});

async function fetchAndShowResults(query) {
  showLoading('Searching all sources…');
  try {
    const results = await fetchAll(query);
    hideLoading();
    if (!results.length) { toast('No results found', ''); return; }
    dom.resultsSheetTitle.textContent = `${results.length} Results`;
    renderResultCards(results, dom.resultsList, applyResultToEditor);
    openResultsSheet();
  } catch (e) {
    hideLoading();
    toast(`Search failed: ${e.message}`, 'error');
  }
}

async function fetchAndEnrichEntry(index) {
  const book = state.library[index];
  if (!book) return;
  try {
    const query   = book.title || book.author || book.fileName;
    const results = await fetchAll(query);
    if (!results.length) return;
    const best = results[0];
    // Merge only missing fields
    if (!book.description && best.description) book.description = best.description;
    if (!book.genre       && best.genre)       book.genre       = best.genre;
    if (!book.publisher   && best.publisher)   book.publisher   = best.publisher;
    if (!book.year        && best.year)        book.year        = best.year;
    if (!book.isbn        && best.isbn)        book.isbn        = best.isbn;
    // Fetch cover if none
    if (!book.coverBase64 && best.coverUrl) {
      try {
        const r   = await fetch(best.coverUrl);
        const bl  = await r.blob();
        const b64 = await blobToB64(bl);
        book.coverBase64 = b64.split(',')[1];
        book.coverMime   = bl.type;
      } catch {}
    }
    await persistLibrary();
    renderLibrary();
  } catch {}
}

// Cover actions
$('btnHeroCoverChange').addEventListener('click', () => { haptic('Light'); pickNewCover(); });

function pickNewCover() {
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const b64  = await blobToB64(file);
    const book = state.library[state.activeBookIndex];
    if (book) {
      book.coverBase64 = b64.split(',')[1];
      book.coverMime   = file.type;
    }
    dom.heroCover.src = b64;
    dom.heroCover.style.display = 'block';
    dom.heroBg.style.backgroundImage = `url('${b64}')`;
    await persistLibrary();
    renderLibrary();
    toast('Cover updated', 'success');
  };
  input.click();
}


// ─── Results Sheet ────────────────────────────────────────────────────────────
function openResultsSheet() {
  dom.resultsBackdrop.style.display = 'block';
  dom.resultsSheet.style.display    = 'flex';
  requestAnimationFrame(() => dom.resultsSheet.classList.add('open'));
}

function closeResultsSheet() {
  dom.resultsSheet.classList.remove('open');
  setTimeout(() => {
    dom.resultsBackdrop.style.display = 'none';
    dom.resultsSheet.style.display    = 'none';
  }, 400);
}

$('btnCloseResults').addEventListener('click', () => { haptic('Light'); closeResultsSheet(); });
dom.resultsBackdrop.addEventListener('click', closeResultsSheet);

async function applyResultToEditor(r) {
  haptic('Medium');
  closeResultsSheet();

  if (r.title)       dom.fTitle.value       = r.title;
  if (r.author)      dom.fAuthor.value      = r.author;
  if (r.narrator)    dom.fNarrator.value    = r.narrator;
  if (r.publisher)   dom.fPublisher.value   = r.publisher;
  if (r.year)        dom.fYear.value        = r.year;
  if (r.isbn)        dom.fISBN.value        = r.isbn;
  if (r.genre)       dom.fGenre.value       = r.genre;
  if (r.language)    dom.fLanguage.value    = r.language;
  if (r.description) dom.fDescription.value = r.description;

  dom.heroTitle.textContent  = dom.fTitle.value  || '—';
  dom.heroAuthor.textContent = dom.fAuthor.value || '—';

  if (r.coverUrl) {
    showLoading('Fetching cover…');
    try {
      const resp = await fetch(r.coverUrl);
      const blob = await resp.blob();
      const b64  = await blobToB64(blob);
      const book = state.library[state.activeBookIndex];
      if (book) { book.coverBase64 = b64.split(',')[1]; book.coverMime = blob.type; }
      dom.heroCover.src = b64;
      dom.heroCover.style.display = 'block';
      dom.heroBg.style.backgroundImage = `url('${b64}')`;
      renderLibrary();
    } catch {}
    hideLoading();
  }

  toast('Applied!', 'success');
}

// ─── Global Search Tab ────────────────────────────────────────────────────────
let searchDebounce;
dom.globalSearchInput.addEventListener('input', () => {
  const q = dom.globalSearchInput.value.trim();
  dom.btnSearchClear.classList.toggle('hidden', !q);
  clearTimeout(searchDebounce);
  if (!q) {
    dom.searchResultsWrap.innerHTML = '<div class="search-placeholder"><p>Search all sources at once<br/>and tap a result to apply it</p></div>';
    return;
  }
  searchDebounce = setTimeout(() => runGlobalSearch(q), 600);
});

dom.globalSearchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearTimeout(searchDebounce); runGlobalSearch(dom.globalSearchInput.value.trim()); }
});

dom.btnSearchClear.addEventListener('click', () => {
  dom.globalSearchInput.value = '';
  dom.btnSearchClear.classList.add('hidden');
  dom.searchResultsWrap.innerHTML = '<div class="search-placeholder"><p>Search all sources at once<br/>and tap a result to apply it</p></div>';
});

async function runGlobalSearch(query) {
  if (!query) return;
  showLoading('Searching…');
  dom.searchResultsWrap.innerHTML = '';
  try {
    const results = await fetchAll(query);
    hideLoading();
    if (!results.length) {
      dom.searchResultsWrap.innerHTML = '<div class="search-placeholder"><p>No results found</p></div>';
      return;
    }
    renderResultCards(results, dom.searchResultsWrap, r => {
      toast('Opening editor to apply…', '', 2000);
      setTimeout(() => {
        if (state.activeBookIndex >= 0) {
          applyResultToEditor(r);
          openEditor(state.activeBookIndex);
        } else {
          toast('Open a book first to apply metadata', '');
        }
      }, 300);
    });
  } catch (e) {
    hideLoading();
    dom.searchResultsWrap.innerHTML = '<div class="search-placeholder"><p>Search failed</p></div>';
  }
}

// ─── Result Card Renderer (shared) ───────────────────────────────────────────
function renderResultCards(results, container, onApply) {
  container.innerHTML = '';
  const srcClass = {
    'Google Books':     'src-google',
    'Open Library':     'src-open',
    'iTunes / Audible': 'src-itunes',
    'MusicBrainz':      'src-musicbrainz',
  };

  results.forEach((r, i) => {
    const card = document.createElement('div');
    card.className = 'result-card fade-up';
    card.style.animationDelay = `${Math.min(i * 35, 250)}ms`;

    const thumbHtml = r.coverUrl
      ? `<img class="result-thumb" src="${r.coverUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="result-thumb-empty"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

    card.innerHTML = `
      ${thumbHtml}
      <div class="result-info">
        <div class="result-title">${esc(r.title || '—')}</div>
        <div class="result-author">${esc(r.author || '—')}</div>
        <div class="result-meta">
          ${r.year ? `<span style="font-size:11px;color:var(--t3)">${esc(r.year)}</span>` : ''}
          <span class="source-tag ${srcClass[r.source] || ''}">${esc(r.source)}</span>
        </div>
      </div>`;

    card.addEventListener('click', () => { haptic('Medium'); onApply(r); });
    container.appendChild(card);
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────
dom.settingGDriveId.value = state.settings.googleDriveClientId;
dom.settingGDriveId.addEventListener('change', async () => {
  state.settings.googleDriveClientId = dom.settingGDriveId.value.trim();
  await persistSettings();
  toast('Settings saved', 'success');
});

// Auto-fetch toggle
const autoFetchToggle = dom.settingAutoFetch.querySelector('.toggle');
if (state.settings.autoFetch) autoFetchToggle?.classList.add('active');
dom.settingAutoFetch.addEventListener('click', async () => {
  haptic('Light');
  state.settings.autoFetch = !state.settings.autoFetch;
  autoFetchToggle?.classList.toggle('active', state.settings.autoFetch);
  await persistSettings();
});

// Clear library (use modal)
$('btnClearLibrary').addEventListener('click', async () => {
  const ok = await showConfirm('Remove all books from library?', 'This will permanently remove all items from your library.');
  if (!ok) return;
  haptic('Heavy');
  state.library = [];
  state.activeBookIndex = -1;
  await persistLibrary();
  renderLibrary();
  toast('Library cleared', '');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function guessTitle(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmtDuration(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2,'0')}m`
    : `${m}m ${String(s).padStart(2,'0')}s`;
}

function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
await loadPersistedData();
dom.settingGDriveId.value = state.settings.googleDriveClientId;
renderLibrary();
switchTab('Library');
