/**
 * src/utils/audioCombiner.js
 * Combines multiple audio files into a single m4b audiobook using FFmpeg (via worker).
 */

export async function combineAudioFiles(files, outputName, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/ffmpegWorker.js', import.meta.url),
      {
        type: 'module',
      }
    );

    let resolved = false;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.event === 'progress') {
        if (onProgress) onProgress(msg.pct);
      } else if (msg.event === 'done') {
        resolved = true;
        const blob = new Blob([msg.buffer], { type: 'audio/m4b' });
        const file = new File([blob], msg.name, { type: 'audio/m4b' });
        worker.terminate();
        resolve(file);
      } else if (msg.event === 'error') {
        resolved = true;
        worker.terminate();
        reject(new Error(msg.message || 'FFmpeg error'));
      }
    };

    worker.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        worker.terminate();
        reject(err);
      }
    };

    // Prepare parts for the worker
    // The worker expects objects with { ext, file, name }
    // We pass the File object directly which is clonable
    const parts = files.map((f) => ({
      ext: f.name.split('.').pop(),
      file: f,
      name: f.name,
    }));

    worker.postMessage({
      cmd: 'concat',
      parts: parts,
      outName: outputName,
    });
  });
}
