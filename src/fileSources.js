/**
 * src/fileSources.js
 * Handles file access from three sources:
 *  1. Local (on-device)
 *  2. iCloud Drive (via iOS document picker → same API)
 *  3. Google Drive (OAuth2 → Google Picker API → download)
 */

// ─── Document Picker (Local + iCloud) ────────────────────────────────────────
// @capacitor-community/document-picker opens the native iOS Files app,
// which already surfaces both local storage AND iCloud Drive.

let FilePicker;
try {
  const mod = await import('@capacitor-community/document-picker');
  FilePicker = mod.DocumentPicker || mod.default;
} catch {
  FilePicker = null;
}

export async function pickFromFiles() {
  if (!FilePicker) {
    return simulateFilePick();
  }

  try {
    const result = await FilePicker.getDocument({
      multiple:  true,
      mimeTypes: [
        'application/epub+zip',
        'application/pdf',
        'audio/mpeg',
        'audio/mp4',
        'audio/flac',
        'audio/ogg',
        'audio/x-m4b',
        '*/*',
      ],
    });

    return (result.uris || []).map(uri => ({
      uri,
      name:   uri.split('/').pop().split('?')[0],
      format: getFormat(uri),
      source: 'local',
    }));
  } catch (e) {
    if (e.message?.includes('cancelled')) return [];
    throw e;
  }
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
