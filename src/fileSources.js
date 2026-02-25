/**
 * src/fileSources.js
 * Handles file access from three sources:
 *  1. Local (on-device)
 *  2. iCloud Drive (via iOS document picker → same API)
 *  3. Google Drive (OAuth2 → Google Picker API → download)
 */

// ─── Document Picker (Local + iCloud) ────────────────────────────────────────
// Uses @capawesome/capacitor-file-picker if available (native iOS),
// otherwise falls back to browser <input type="file">.

let FilePicker;
try {
  const mod = await import('@capawesome/capacitor-file-picker');
  FilePicker = mod.FilePicker || mod.default;
} catch {
  FilePicker = null;
}

export async function pickFromFiles() {
  if (!FilePicker) {
    return simulateFilePick();
  }

  try {
    const result = await FilePicker.pickFiles({
      multiple:  true,
      types: [
        'application/epub+zip',
        'application/pdf',
        'audio/mpeg',
        'audio/mp4',
        'audio/flac',
        'audio/ogg',
        'audio/x-m4b',
      ],
    });

    return (result.files || []).map(f => ({
      uri:    f.path || f.uri,
      name:   f.name || (f.path && f.path.split('/').pop().split('?')[0]),
      format: getFormat(f.name || f.path || ''),
      source: 'local',
    }));
  } catch (e) {
    if (e.message?.includes('cancel')) return [];
    throw e;
  }
}

// ─── Folder / audiobook folder import ─────────────────────────────────────────
// Attempts to let the native picker choose a directory; falls back to a
// browser `input.webkitdirectory` flow which groups files by their top-level
// folder and returns 'audiobook' style entries with `parts` arrays.
export async function pickFolder() {
  // If the Capacitor document picker provides a directory API, try it.
  try {
    if (FilePicker && typeof FilePicker.getDirectory === 'function') {
      const res = await FilePicker.getDirectory();
      // Expected: res.files or similar; normalize conservatively.
      const files = res.files || [];
      return groupFilesAsFolders(files.map(f => ({ uri: f.uri || f.path, name: f.name || (f.path && f.path.split('/').pop()), file: null })));
    }
  } catch (e) {
    // ignore and fall back to browser behavior
  }

  // Browser fallback
  return simulateFolderPick();
}

// ─── Google Drive ─────────────────────────────────────────────────────────────
// Opens Google Picker in @capacitor/browser in-app sheet.
// After user picks, we receive the file ID via a custom URL scheme callback.

let Browser;
try {
  ({ Browser } = await import('@capacitor/browser'));
} catch {
  Browser = null;
}

export function buildGooglePickerUrl(clientId, redirectUri) {
  // Google Drive OAuth2 → Picker API flow
  // The web app at redirectUri receives the file info and deep-links back
  const scopes     = encodeURIComponent('https://www.googleapis.com/auth/drive.readonly');
  const state      = encodeURIComponent(JSON.stringify({ action: 'gdrive-pick' }));
  return (
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${scopes}` +
    `&state=${state}` +
    `&include_granted_scopes=true`
  );
}

export async function openGoogleDrivePicker(clientId) {
  if (!Browser || !clientId) {
    showGDriveSetupHint();
    return [];
  }
  // The redirect URI is the in-app page that hosts the Google Picker widget
  const redirectUri = `${window.location.origin}/gdrive-picker.html`;
  const url         = buildGooglePickerUrl(clientId, redirectUri);
  await Browser.open({ url, presentationStyle: 'popover' });
  // Actual file receipt handled via App.addListener('appUrlOpen') in app.js
  return [];
}

// Called from app.js when the app URL scheme fires after Google auth
export async function downloadGoogleFile(accessToken, fileId, fileName) {
  const url  = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Drive download failed: ${resp.status}`);
  const blob    = await resp.blob();
  const dataUrl = await blobToDataUrl(blob);
  return {
    uri:    dataUrl,      // data URL used as the "uri" for in-memory processing
    name:   fileName,
    format: getFormat(fileName),
    source: 'gdrive',
    blob,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SUPPORTED_EXTS = new Set(['epub','pdf','mp3','m4b','m4a','flac','ogg','opus']);

export function getFormat(nameOrUri) {
  return (nameOrUri.split('.').pop().split('?')[0] || '').toLowerCase();
}

export function isSupportedFormat(name) {
  return SUPPORTED_EXTS.has(getFormat(name));
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function showGDriveSetupHint() {
  window.dispatchEvent(new CustomEvent('app:toast', {
    detail: { msg: 'Add your Google Client ID in Settings to enable Drive', type: 'info', ms: 5000 },
  }));
}

// Dev/browser simulation when Capacitor APIs unavailable
async function simulateFilePick() {
  return new Promise(resolve => {
    const input     = document.createElement('input');
    input.type      = 'file';
    input.multiple  = true;
    input.accept    = '.epub,.pdf,.mp3,.m4b,.m4a,.flac,.ogg,.opus';
    input.onchange  = () => {
      const files = Array.from(input.files || [])
        .filter(f => isSupportedFormat(f.name))
        .map(f => ({
          uri:    URL.createObjectURL(f),
          name:   f.name,
          format: getFormat(f.name),
          source: 'local',
          file:   f,
        }));
      resolve(files);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

function simulateFolderPick() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.accept = '.mp3,.m4b,.m4a,.flac,.ogg,.opus';
    input.onchange = () => {
      const files = Array.from(input.files || []);
      const folderEntries = groupFilesAsFolders(files.map(f => ({ file: f, name: f.name, uri: URL.createObjectURL(f), relativePath: f.webkitRelativePath || f.name })));
      resolve(folderEntries);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

function groupFilesAsFolders(items) {
  // items: { file?, name, uri, relativePath }
  const byFolder = {};
  for (const it of items) {
    const rel = it.relativePath || it.name || '';
    const parts = rel.split('/').filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : (it.name || 'root');
    byFolder[folder] = byFolder[folder] || [];
    byFolder[folder].push({ name: it.name, uri: it.uri, file: it.file || null, format: getFormat(it.name) });
  }

  // Convert to array of folder entries. If folder contains mostly audio files,
  // treat it as an audiobook with `parts` array.
  const out = [];
  for (const [folderName, files] of Object.entries(byFolder)) {
    const audioCount = files.filter(f => SUPPORTED_EXTS.has(f.format)).length;
    if (audioCount >= 2) {
      out.push({
        name: folderName,
        source: 'local-folder',
        format: 'audiobook-folder',
        parts: files.sort((a,b) => a.name.localeCompare(b.name)),
      });
    } else {
      // Not a multi-part audiobook: expose individual files instead
      for (const f of files) out.push({ uri: f.uri, name: f.name, format: f.format, source: 'local', file: f.file });
    }
  }
  return out;
}
