/**
 * Browser-only file picker for books and audiobook folders.
 */

const SUPPORTED_EXTS = new Set(['epub', 'pdf', 'mp3', 'm4b', 'm4a', 'flac', 'ogg', 'opus']);
const ACCEPT = '.epub,.pdf,.mp3,.m4b,.m4a,.flac,.ogg,.opus';

function getFormat(name) {
  return (name.split('.').pop().split('?')[0] || '').toLowerCase();
}

export function isSupportedFormat(name) {
  return SUPPORTED_EXTS.has(getFormat(name));
}

export function pickFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ACCEPT;
    input.onchange = () => {
      const files = Array.from(input.files || [])
        .filter((f) => isSupportedFormat(f.name))
        .map((f) => ({ file: f, name: f.name, format: getFormat(f.name) }));
      resolve(files);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export function pickFolder() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    if (!('webkitdirectory' in input)) {
      resolve([]);
      return;
    }
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      resolve(groupAsFolders(files));
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

function groupAsFolders(files) {
  const byFolder = {};
  for (const f of files) {
    if (!isSupportedFormat(f.name)) continue;
    const parts = (f.webkitRelativePath || f.name).split('/').filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : 'root';
    byFolder[folder] = byFolder[folder] || [];
    byFolder[folder].push({ file: f, name: f.name, format: getFormat(f.name) });
  }

  const out = [];
  for (const [folderName, items] of Object.entries(byFolder)) {
    if (items.length >= 2) {
      out.push({
        name: folderName,
        format: 'audiobook-folder',
        parts: items.sort((a, b) => a.name.localeCompare(b.name)),
      });
    } else {
      out.push(...items);
    }
  }
  return out;
}
