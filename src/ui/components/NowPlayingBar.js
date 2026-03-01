import {
  getCurrentlyReading,
  getBookInsights,
  isAudioFormat,
} from '../../state/selectors.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

export function NowPlayingBar(covers = {}) {
  const book = getCurrentlyReading();
  if (!book) return '';

  const cover = covers[book.id];
  const isAudio = isAudioFormat(book.format);
  const insights = getBookInsights(book.id);
  const progress = book.progress || 0;

  const coverHtml = cover
    ? `<img src="data:${cover.mime};base64,${cover.base64}" alt="" class="now-playing-cover">`
    : `<div class="now-playing-cover now-playing-cover-placeholder">${
        isAudio ? icons.headphones : icons.bookOpen
      }</div>`;

  const remainingInfo =
    isAudio && insights && insights.remainingListenMinutes > 0
      ? `<span class="now-playing-remaining">${formatDuration(
          insights.remainingListenMinutes
        )} left</span>`
      : insights && insights.estimatedRemainingMinutes > 0
      ? `<span class="now-playing-remaining">~${formatDuration(
          insights.estimatedRemainingMinutes
        )} left</span>`
      : '';

  return `
    <div class="now-playing-bar" data-action="open-detail" data-book-id="${
      book.id
    }">
      <div class="now-playing-progress-track">
        <div class="now-playing-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="now-playing-content">
        <div class="now-playing-left">
          ${coverHtml}
          <div class="now-playing-info">
            <div class="now-playing-title">${escapeHtml(
              book.title || 'Untitled'
            )}</div>
            <div class="now-playing-meta">
              <span class="now-playing-author">${escapeHtml(
                book.author || 'Unknown'
              )}</span>
              ${remainingInfo}
            </div>
          </div>
        </div>
        <div class="now-playing-controls" data-stop-propagation>
          <button class="now-playing-btn" data-action="quick-progress-down" data-book-id="${
            book.id
          }" title="−5%">
            ${icons.rewind}
          </button>
          <button class="now-playing-btn now-playing-btn-main" data-action="toggle-now-playing-timer" data-book-id="${
            book.id
          }" title="Timer">
            ${icons.play}
          </button>
          <button class="now-playing-btn" data-action="quick-progress-up" data-book-id="${
            book.id
          }" title="+5%">
            ${icons.fastForward}
          </button>
        </div>
      </div>
    </div>
  `;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
