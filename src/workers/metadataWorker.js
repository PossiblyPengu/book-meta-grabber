import { parseBlob } from 'music-metadata-browser';

self.addEventListener('message', async (ev) => {
  const { cmd, buffer, fileName } = ev.data || {};
  if (cmd === 'parse') {
    try {
      const blob = new Blob([buffer]);
      const meta = await parseBlob(blob, { skipPostHeaders: true, includeChapters: true });
      const { common, format } = meta;
      let coverBase64 = null, coverMime = null;
      if (common.picture?.[0]) {
        const pic = common.picture[0];
        const b64 = arrayBufferToBase64(pic.data);
        coverBase64 = b64;
        coverMime = pic.format || 'image/jpeg';
      }

      const result = {
        title: common.title || guessTitle(fileName),
        author: common.artist || common.albumartist || '',
        narrator: common.composer || '',
        series: common.album || '',
        year: common.year ? String(common.year) : '',
        publisher: common.label?.[0] || '',
        description: common.comment?.[0] || '',
        genre: common.genre?.[0] || '',
        language: common.language || '',
        coverBase64,
        coverMime,
        duration: format.duration ? Math.round(format.duration) : null,
        bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
        sampleRate: format.sampleRate || null,
        channels: format.numberOfChannels || null,
      };

      self.postMessage({ event: 'result', result });
    } catch (e) {
      self.postMessage({ event: 'error', message: e?.message || String(e) });
    }
  }
});

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
  return (name || '').toString().replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export {};
