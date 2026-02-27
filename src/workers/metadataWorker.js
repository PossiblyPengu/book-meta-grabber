import { parseBlob } from 'music-metadata-browser';

self.addEventListener('message', async (ev) => {
  const { cmd, buffer, fileName } = ev.data || {};
  if (cmd === 'parse') {
    try {
      // Validate input
      if (!buffer || !fileName) {
        throw new Error('Invalid input: buffer and fileName required');
      }

      // Check file size to prevent DoS
      if (buffer.byteLength > 100 * 1024 * 1024) {
        // 100MB limit
        throw new Error('File too large for processing');
      }

      const blob = new Blob([buffer]);
      const meta = await parseBlob(blob, {
        skipPostHeaders: true,
        includeChapters: true,
      });
      const { common, format } = meta;
      let coverBase64 = null,
        coverMime = null;
      if (common.picture?.[0]) {
        const pic = common.picture[0];
        // Validate cover image size
        if (pic.data && pic.data.length < 10 * 1024 * 1024) {
          // 10MB limit
          const b64 = arrayBufferToBase64(pic.data);
          coverBase64 = b64;
          coverMime = pic.format || 'image/jpeg';
        }
      }

      const result = {
        title: common.title || guessTitle(fileName),
        author: common.artist || common.albumartist || '',
        narrator: findNarrator(common) || common.composer || '',
        series: common.album || '',
        year: common.year ? String(common.year) : '',
        publisher: common.label?.[0] || '',
        description: common.comment?.[0] || '',
        genre: isAudiobook(common, fileName, format.duration)
          ? 'Audiobook'
          : common.genre?.[0] || '',
        language: common.language || '',
        coverBase64,
        coverMime,
        duration: format.duration ? Math.round(format.duration) : null,
        bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
        sampleRate: format.sampleRate || null,
        channels: format.numberOfChannels || null,
        codec: format.codec || '',
        track: common.track || { no: null, of: null },
        disk: common.disk || { no: null, of: null },
      };

      self.postMessage({ event: 'result', result });
    } catch (e) {
      // Use self.postMessage instead of console for worker errors
      self.postMessage({ event: 'error', message: e?.message || String(e) });
    }
  }
});

function findNarrator(common) {
  if (common.comment) {
    const comments = Array.isArray(common.comment)
      ? common.comment
      : [common.comment];
    const narratorComment = comments.find(
      (c) =>
        c.toLowerCase().includes('narrator') ||
        c.toLowerCase().includes('read by') ||
        c.toLowerCase().includes('voiced by')
    );
    if (narratorComment) {
      const match = narratorComment.match(
        /(?:narrator|read by|voiced by)[:\s]+(.+?)(?:[,;]|$)/i
      );
      return match ? match[1].trim() : null;
    }
  }
  return null;
}

function isAudiobook(common, fileName, duration) {
  const indicators = [
    fileName.toLowerCase().includes('audiobook'),
    fileName.toLowerCase().includes('unabridged'),
    fileName.toLowerCase().includes('abridged'),
    common.genre?.some((g) => g.toLowerCase().includes('audiobook')),
    common.album?.toLowerCase().includes('audiobook'),
    duration && duration > 600, // > 10 mins
    common.track?.no === 1 && !common.disk?.no,
  ];
  return indicators.some(Boolean);
}

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function guessTitle(name) {
  return (name || '')
    .toString()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
