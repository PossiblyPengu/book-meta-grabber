/**
 * ISBN Barcode Scanner using BarcodeDetector API + camera.
 * Falls back gracefully if BarcodeDetector is not available.
 */

/* global BarcodeDetector */

export function isScannerSupported() {
  return 'BarcodeDetector' in window;
}

export async function startScanner(onDetect, onError) {
  if (!isScannerSupported()) {
    onError?.('Barcode scanning is not supported in this browser');
    return null;
  }

  let stream = null;
  let animId = null;
  let stopped = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch (e) {
    onError?.('Camera access denied');
    return null;
  }

  const video = document.createElement('video');
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play();

  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });

  async function scan() {
    if (stopped) return;
    try {
      const barcodes = await detector.detect(video);
      for (const barcode of barcodes) {
        const isbn = barcode.rawValue;
        if (isbn && /^\d{10,13}$/.test(isbn)) {
          onDetect(isbn);
          return; // Stop after first valid detection
        }
      }
    } catch {}
    animId = requestAnimationFrame(scan);
  }

  scan();

  return {
    video,
    stop() {
      stopped = true;
      if (animId) cancelAnimationFrame(animId);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
