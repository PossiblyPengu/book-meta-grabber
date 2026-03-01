import { getState } from '../../state/store.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

export function AudioPlayer(book, _insights) {
  if (!book) return '';

  const { settings } = getState();
  const speed = settings.playbackSpeed || 1;
  const progress = book.progress || 0;

  // Duration display
  const duration = book.duration || '';
  let totalSecs = 0;
  if (duration) {
    const parts = duration.split(':').map(Number);
    if (parts.length === 3)
      totalSecs = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSecs = parts[0] * 3600 + parts[1] * 60;
  }

  const listenedSecs = Math.round(totalSecs * (progress / 100));
  const remainingSecs = totalSecs - listenedSecs;

  // Adjusted remaining with playback speed
  const adjustedRemaining =
    speed > 0 ? Math.round(remainingSecs / speed) : remainingSecs;

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <span>${icons.headphones} Audio Player</span>
      </div>
      <div class="audio-player">
        <div class="audio-player-display">
          <div class="audio-player-waveform" id="audioWaveform">
            ${renderWaveform(progress)}
          </div>
          <div class="audio-player-times">
            <span class="audio-player-current">${
              totalSecs > 0 ? formatTime(listenedSecs) : '--:--'
            }</span>
            <span class="audio-player-total">${
              totalSecs > 0 ? formatTime(totalSecs) : '--:--'
            }</span>
          </div>
        </div>

        <div class="audio-player-scrubber" data-stop-propagation>
          <input type="range" class="audio-scrubber" id="audioScrubber"
            min="0" max="100" value="${progress}" step="1"
            data-action="audio-scrub" data-book-id="${book.id}">
        </div>

        <div class="audio-player-controls">
          <button class="audio-btn" data-action="audio-skip-back" data-book-id="${
            book.id
          }" title="−30s">
            ${icons.rewind}
          </button>
          <button class="audio-btn audio-btn-play" data-action="toggle-now-playing-timer" data-book-id="${
            book.id
          }">
            ${icons.play}
          </button>
          <button class="audio-btn" data-action="audio-skip-forward" data-book-id="${
            book.id
          }" title="+30s">
            ${icons.fastForward}
          </button>
        </div>

        <div class="audio-player-bottom">
          <div class="audio-speed-control">
            <span class="audio-speed-label">Speed</span>
            <div class="audio-speed-pills">
              ${speeds
                .map(
                  (s) => `
                <button class="audio-speed-pill ${s === speed ? 'active' : ''}"
                  data-action="set-playback-speed" data-speed="${s}">
                  ${s}x
                </button>
              `
                )
                .join('')}
            </div>
          </div>
          ${
            totalSecs > 0
              ? `
            <div class="audio-remaining">
              <span class="audio-remaining-label">Remaining at ${speed}x:</span>
              <span class="audio-remaining-value">${formatTime(
                adjustedRemaining
              )}</span>
            </div>
          `
              : ''
          }
        </div>

        ${
          book.narrator
            ? `
          <div class="audio-narrator">
            ${icons.volume2} Narrated by <strong>${escapeHtml(
                book.narrator
              )}</strong>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

function renderWaveform(progress) {
  // Generate a decorative waveform visualization
  const bars = 40;
  let html = '';
  for (let i = 0; i < bars; i++) {
    const pct = (i / bars) * 100;
    const active = pct < progress;
    // Pseudo-random heights for visual interest
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const height = 20 + Math.abs(seed - Math.floor(seed)) * 80;
    html += `<div class="waveform-bar ${
      active ? 'active' : ''
    }" style="height:${height}%"></div>`;
  }
  return html;
}
