import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

let ffmpeg = null;
let aborted = false;

self.addEventListener('message', async (ev) => {
  const { cmd, parts, outName } = ev.data || {};
  if (cmd === 'abort') {
    aborted = true;
    try {
      ffmpeg?.exit && ffmpeg.exit();
    } catch {}
    self.postMessage({ event: 'aborted' });
    return;
  }

  if (cmd === 'concat') {
    try {
      if (!ffmpeg) {
        ffmpeg = createFFmpeg({ log: false });
        await ffmpeg.load();
        ffmpeg.setProgress(({ ratio }) => {
          const pct = Math.round(ratio * 100);
          self.postMessage({ event: 'progress', pct });
        });
      }

      const listLines = [];
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const data =
          p.arrayBuffer instanceof Function ? await p.arrayBuffer() : p.data;
        const name = `part${i}.${p.ext || 'mp3'}`;
        ffmpeg.FS('writeFile', name, await fetchFile(new Uint8Array(data)));
        listLines.push(`file '${name}'`);
      }

      ffmpeg.FS('writeFile', 'list.txt', listLines.join('\n'));
      const outFile = `${(outName || 'out').replace(/[^a-z0-9]/gi, '_')}.m4b`;
      await ffmpeg.run(
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        'list.txt',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outFile
      );

      const data = ffmpeg.FS('readFile', outFile);
      // transfer the ArrayBuffer back
      const ab = data.buffer.slice(0);
      self.postMessage({ event: 'done', name: outFile, buffer: ab }, [ab]);

      // cleanup
      try {
        ffmpeg.FS('unlink', 'list.txt');
      } catch {}
      for (let i = 0; i < parts.length; i++)
        try {
          ffmpeg.FS('unlink', `part${i}.${parts[i].ext || 'mp3'}`);
        } catch {}
      try {
        ffmpeg.FS('unlink', outFile);
      } catch {}
    } catch (e) {
      if (aborted) {
        self.postMessage({ event: 'error', name: 'FFMPEG_ABORT' });
      } else {
        self.postMessage({ event: 'error', message: e?.message || String(e) });
      }
    }
  }
});

export {};
