/**
 * src/exporter.js
 * Apply metadata to files and offer a download in-browser.
 * Supports: EPUB (writes OPF + embedded cover), MP3 (ID3v2 via browser-id3-writer).
 */

export async function exportWithMetadata(source, metadata) {
  // `source` can be a Blob/File or a data/object URL string
  const blob = await fetchBlob(source);
  const fmt = (
    metadata.format ||
    (metadata.fileName || '').split('.').pop() ||
    ''
  ).toLowerCase();
  if (fmt === 'epub') return exportEpub(blob, metadata);
  if (fmt === 'mp3') return exportMp3(blob, metadata);
  // Fallback: return original file as download with a metadata JSON sidecar
  return downloadBlob(blob, metadata.fileName || `file.${fmt}`);
}

async function fetchBlob(source) {
  if (!source) throw new Error('No source provided');
  if (source instanceof Blob) return source;
  if (typeof source === 'string') {
    // data: or object URL or http(s)
    const r = await fetch(source);
    return await r.blob();
  }
  if (source.file instanceof File) return source.file;
  throw new Error('Unsupported source type');
}

async function exportEpub(blob, metadata) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);

  const containerXml =
    (await zip.file('META-INF/container.xml')?.async('string')) || '';
  const opfPathMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
  if (!opfPathMatch) {
    // cannot locate OPF — download original
    return downloadBlob(blob, metadata.fileName || 'book.epub');
  }
  const opfPath = opfPathMatch[1];
  const opfContent = await zip.file(opfPath).async('string');

  // Parse OPF XML and update common fields
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, 'application/xml');

  function ensureDc(tag, value) {
    if (!value) return;
    const el = doc.getElementsByTagNameNS(
      'http://purl.org/dc/elements/1.1/',
      tag
    )[0];
    if (el) el.textContent = value;
    else {
      const metadataEl =
        doc.getElementsByTagName('metadata')[0] || doc.documentElement;
      const newEl = doc.createElementNS(
        'http://purl.org/dc/elements/1.1/',
        `dc:${tag}`
      );
      newEl.textContent = value;
      metadataEl.appendChild(newEl);
    }
  }

  ensureDc('title', metadata.title);
  ensureDc('creator', metadata.author);
  ensureDc('publisher', metadata.publisher);
  ensureDc('date', metadata.year);
  ensureDc('identifier', metadata.isbn || metadata.identifier);

  // If cover present, embed it and ensure manifest/meta entries
  if (metadata.coverBase64) {
    const opfDir = opfPath.includes('/')
      ? opfPath.split('/').slice(0, -1).join('/') + '/'
      : '';
    const coverRelPath = opfDir + 'images/cover.jpg';
    const coverData = base64ToUint8Array(metadata.coverBase64);
    zip.file(coverRelPath, coverData);

    // add manifest item
    const manifest = doc.getElementsByTagName('manifest')[0];
    if (manifest) {
      const exists = Array.from(manifest.getElementsByTagName('item')).some(
        (i) => i.getAttribute('href') === 'images/cover.jpg'
      );
      if (!exists) {
        const id = 'cover-image';
        const item = doc.createElement('item');
        item.setAttribute('id', id);
        item.setAttribute('href', 'images/cover.jpg');
        item.setAttribute('media-type', 'image/jpeg');
        manifest.appendChild(item);

        // add meta name=cover
        const metadataEl = doc.getElementsByTagName('metadata')[0];
        if (metadataEl) {
          const meta = doc.createElement('meta');
          meta.setAttribute('name', 'cover');
          meta.setAttribute('content', id);
          metadataEl.appendChild(meta);
        }
      }
    }
  }

  const serializer = new XMLSerializer();
  const newOpf = serializer.serializeToString(doc);
  zip.file(opfPath, newOpf);

  const outBlob = await zip.generateAsync({ type: 'blob' });
  return downloadBlob(outBlob, metadata.fileName || 'book.epub');
}

async function exportMp3(blob, metadata) {
  // Use browser-id3-writer ESM if available
  const mod = await import('browser-id3-writer');
  const ID3Writer = mod.default || mod.ID3Writer || mod;
  const arrayBuffer = await blob.arrayBuffer();
  const writer = new ID3Writer(new Uint8Array(arrayBuffer));
  if (metadata.title) writer.setFrame('TIT2', metadata.title);
  if (metadata.author) writer.setFrame('TPE1', [metadata.author]);
  if (metadata.series) writer.setFrame('TALB', metadata.series);
  if (metadata.year) writer.setFrame('TYER', metadata.year);
  if (metadata.genre) writer.setFrame('TCON', [metadata.genre]);
  if (metadata.description)
    writer.setFrame('COMM', { description: '', text: metadata.description });
  if (metadata.coverBase64) {
    const mime = metadata.coverMime || 'image/jpeg';
    const imageBytes = base64ToUint8Array(metadata.coverBase64);
    writer.setFrame('APIC', {
      type: 3,
      data: imageBytes,
      description: '',
      mimeType: mime,
    });
  }
  writer.addTag();
  const outBlob = writer.getBlob();
  return downloadBlob(outBlob, metadata.fileName || 'track.mp3');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function base64ToUint8Array(b64) {
  const binary = atob(b64.replace(/^data:[^;]+;base64,/, ''));
  const len = binary.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}

export default { exportWithMetadata };
