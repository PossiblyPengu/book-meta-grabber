/**
 * src/extractors/index.js
 * Browser-safe metadata extractor.
 * Uses music-metadata-browser for audio, manual ZIP parse for EPUB,
 * and PDF.js worker (CDN) for PDF.
 */

// ─── Audio (music-metadata-browser) ──────────────────────────────────────────
async function extractAudio(fileOrBlob, fileName) {
  // Offload to metadata worker to avoid blocking UI
  return new Promise((res, rej) => {
    let worker = null;
    let timeoutId = null;

    try {
      worker = new Worker(
        new URL('../workers/metadataWorker.js', import.meta.url),
        { type: 'module' }
      );

      // Set up timeout to prevent hanging
      timeoutId = setTimeout(() => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
        rej(new Error('Metadata extraction timeout'));
      }, 30000); // 30 second timeout

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (worker) {
          worker.terminate();
          worker = null;
        }
      };

      worker.addEventListener('message', (ev) => {
        const d = ev.data || {};
        if (d.event === 'result') {
          cleanup();
          res(d.result);
        } else if (d.event === 'error') {
          cleanup();
          rej(new Error(d.message || 'metadata parse error'));
        }
      });

      worker.addEventListener('error', (error) => {
        cleanup();
        rej(new Error(`Worker error: ${error.message}`));
      });

      // send ArrayBuffer to worker
      (async () => {
        try {
          const ab = await fileOrBlob.arrayBuffer();
          if (worker) {
            worker.postMessage({ cmd: 'parse', buffer: ab, fileName }, [ab]);
          }
        } catch (error) {
          cleanup();
          rej(error);
        }
      })();
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      if (worker) worker.terminate();
      rej(e);
    }
  });
}

// ─── EPUB (manual OPF parse via JSZip) ───────────────────────────────────────
async function extractEpub(fileOrBlob, fileName) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(fileOrBlob);

  const containerXml =
    (await zip.file('META-INF/container.xml')?.async('string')) || '';
  const opfPathMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
  if (!opfPathMatch) return { title: guessTitle(fileName) };

  const opfContent = (await zip.file(opfPathMatch[1])?.async('string')) || '';
  const opfDir = opfPathMatch[1].includes('/')
    ? opfPathMatch[1].split('/').slice(0, -1).join('/') + '/'
    : '';

  const get = (tag) => {
    const m = opfContent.match(
      new RegExp(`<dc:${tag}[^>]*>([^<]+)</dc:${tag}>`, 'i')
    );
    return m ? m[1].trim() : '';
  };

  // Extract cover
  let coverBase64 = null,
    coverMime = null;
  const coverMatch =
    opfContent.match(/properties="cover-image"[^>]*href="([^"]+)"/i) ||
    opfContent.match(/id="cover[^"]*"[^>]*href="([^"]+)"/i) ||
    opfContent.match(/<meta\s+name="cover"\s+content="([^"]+)"/i);

  if (coverMatch) {
    const coverPath = opfDir + coverMatch[1];
    const coverFile = zip.file(coverPath);
    if (coverFile) {
      const buf = await coverFile.async('uint8array');
      coverBase64 = uint8ToBase64(buf);
      coverMime = coverPath.match(/\.png$/i) ? 'image/png' : 'image/jpeg';
    }
  }

  // If no explicit cover found, pick the largest image in the EPUB (best chance of high-res)
  if (!coverBase64) {
    const imgs = zip.file(/\.(png|jpe?g|webp)$/i) || [];
    if (imgs.length) {
      let bestBuf = null;
      let bestName = null;
      for (const f of imgs) {
        try {
          const buf = await f.async('uint8array');
          if (!bestBuf || buf.length > bestBuf.length) {
            bestBuf = buf;
            bestName = f.name || opfDir + f.name;
          }
        } catch (e) {}
      }
      if (bestBuf) {
        coverBase64 = uint8ToBase64(bestBuf);
        coverMime = bestName.match(/\.png$/i) ? 'image/png' : 'image/jpeg';
      }
    }
  }

  return {
    title: get('title') || guessTitle(fileName),
    author: get('creator') || '',
    publisher: get('publisher') || '',
    year: (get('date') || '').slice(0, 4),
    isbn: get('identifier') || '',
    description: get('description') || '',
    language: get('language') || '',
    coverBase64,
    coverMime,
  };
}

// ─── PDF (PDF.js CDN) ─────────────────────────────────────────────────────────
async function extractPdf(fileOrBlob, fileName) {
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    // PDF.js — load via CDN worker
    const pdfjsLib = await import(
      /* @vite-ignore */ 'pdfjs-dist/legacy/build/pdf.mjs'
    );
    // Let the bundler provide the worker path at runtime; fallback to package worker
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdf.worker.js',
        import.meta.url
      ).toString();
    } catch {}

    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const meta = await doc.getMetadata();
    const info = meta.info || {};

    return {
      title: info.Title || guessTitle(fileName),
      author: info.Author || '',
      year: (info.CreationDate || '').replace(/^D:(\d{4}).*/, '$1'),
      publisher: info.Producer || info.Creator || '',
      description: '',
      language: info.Language || '',
    };
  } catch {
    return { title: guessTitle(fileName) };
  }
}

// ─── Public dispatcher ────────────────────────────────────────────────────────
export async function extractMetadata(fileOrBlob, fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const base = {
    title: '',
    author: '',
    narrator: '',
    series: '',
    year: '',
    publisher: '',
    isbn: '',
    description: '',
    genre: '',
    language: '',
    coverBase64: null,
    coverMime: null,
    duration: null,
    bitrate: null,
    sampleRate: null,
    channels: null,
    trackNumber: null,
    totalTracks: null,
  };

  try {
    const specific = await (() => {
      if (ext === 'epub') return extractEpub(fileOrBlob, fileName);
      if (ext === 'pdf') return extractPdf(fileOrBlob, fileName);
      return extractAudio(fileOrBlob, fileName);
    })();

    // Normalize audio specific fields
    if (specific.track) {
      specific.trackNumber = specific.track.no || null;
      specific.totalTracks = specific.track.of || null;
    }
    if (specific.disk) {
      specific.diskNumber = specific.disk.no || null;
      specific.totalDisks = specific.disk.of || null;
    }

    return { ...base, ...specific, format: ext, fileName };
  } catch (e) {
    return {
      ...base,
      format: ext,
      fileName,
      title: guessTitle(fileName),
      error: e.message,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function guessTitle(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uint8ToBase64(uint8) {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}
