import { getState } from '../../state/store.js';
import {
  getBookById,
  getBookInsights,
  isAudioFormat,
} from '../../state/selectors.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';
import { AudioPlayer } from './AudioPlayer.js';
import { ReadingInsights } from './ReadingInsights.js';

export function BookDetailView(covers = {}) {
  const { ui } = getState();
  const bookId = ui.detailBookId;
  if (!bookId) return '';

  const book = getBookById(bookId);
  if (!book) return '';

  const cover = covers[book.id];
  const isAudio = isAudioFormat(book.format);
  const progress = book.progress || 0;
  const insights = getBookInsights(book.id);

  const coverHtml = cover
    ? `<img src="data:${cover.mime};base64,${cover.base64}" alt="" class="detail-hero-img">`
    : `<div class="detail-hero-placeholder">${
        isAudio ? icons.headphones : icons.bookOpen
      }</div>`;

  // Progress ring SVG
  const ringSize = 120;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  const progressRing = `
    <svg class="detail-progress-ring" width="${ringSize}" height="${ringSize}" viewBox="0 0 ${ringSize} ${ringSize}">
      <circle class="detail-progress-ring-bg" cx="${ringSize / 2}" cy="${
    ringSize / 2
  }" r="${radius}"
        fill="none" stroke="var(--border)" stroke-width="${strokeWidth}"/>
      <circle class="detail-progress-ring-fill" cx="${ringSize / 2}" cy="${
    ringSize / 2
  }" r="${radius}"
        fill="none" stroke="var(--accent)" stroke-width="${strokeWidth}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
        stroke-linecap="round" transform="rotate(-90 ${ringSize / 2} ${
    ringSize / 2
  })"/>
      <text x="${ringSize / 2}" y="${
    ringSize / 2
  }" text-anchor="middle" dy="0.35em"
        class="detail-progress-text">${progress}%</text>
    </svg>
  `;

  // Status badge
  const statusColors = {
    unread: 'var(--text-muted)',
    reading: 'var(--accent)',
    finished: 'var(--status-success)',
    abandoned: 'var(--status-error)',
  };
  const statusLabel =
    (book.status || 'unread').charAt(0).toUpperCase() +
    (book.status || 'unread').slice(1);

  // Stars
  const rating = book.rating || 0;
  const stars =
    rating > 0
      ? `<div class="detail-stars">${'<span class="star-full">★</span>'.repeat(
          Math.floor(rating)
        )}${
          rating % 1 >= 0.5 ? '<span class="star-half">★</span>' : ''
        }${'<span class="star-empty">★</span>'.repeat(
          5 - Math.floor(rating) - (rating % 1 >= 0.5 ? 1 : 0)
        )}</div>`
      : '<div class="detail-stars detail-stars-empty">No rating</div>';

  // Tags
  const tags =
    book.tags && book.tags.length > 0
      ? `<div class="detail-tags">${book.tags
          .map((t) => `<span class="detail-tag">${escapeHtml(t)}</span>`)
          .join('')}</div>`
      : '';

  // Bookmarks
  const bookmarks = book.bookmarks || [];
  const bookmarkHtml =
    bookmarks.length > 0
      ? bookmarks
          .map(
            (bm) => `
        <div class="detail-bookmark">
          <span class="detail-bookmark-icon">${icons.bookmark}</span>
          <span class="detail-bookmark-label">${escapeHtml(
            bm.label || bm.position
          )}</span>
          <span class="detail-bookmark-pos">${escapeHtml(
            bm.position || ''
          )}</span>
          <button class="detail-bookmark-remove" data-action="remove-bookmark" data-book-id="${
            book.id
          }" data-bookmark-id="${bm.id}">${icons.x}</button>
        </div>
      `
          )
          .join('')
      : '<div class="detail-empty-hint">No bookmarks yet</div>';

  // Recent sessions (last 5)
  const sessions = (book.sessions || []).slice(-5).reverse();
  const sessionHtml =
    sessions.length > 0
      ? sessions
          .map(
            (s) => `
        <div class="detail-session">
          <span class="detail-session-date">${s.date || 'Unknown'}</span>
          <span class="detail-session-duration">${s.durationMinutes}m</span>
          ${
            s.notes
              ? `<span class="detail-session-note">${escapeHtml(
                  s.notes
                )}</span>`
              : ''
          }
        </div>
      `
          )
          .join('')
      : '<div class="detail-empty-hint">No sessions logged</div>';

  // Metadata pills
  const metaPills = [
    book.format &&
      `<span class="detail-meta-pill">${escapeHtml(
        book.format.toUpperCase()
      )}</span>`,
    book.year &&
      `<span class="detail-meta-pill">${escapeHtml(book.year)}</span>`,
    book.genre &&
      `<span class="detail-meta-pill">${escapeHtml(book.genre)}</span>`,
    book.language &&
      `<span class="detail-meta-pill">${escapeHtml(
        book.language.toUpperCase()
      )}</span>`,
  ]
    .filter(Boolean)
    .join('');

  return `
    <div class="detail-overlay open" data-action="close-detail"></div>
    <div class="detail-view open">
      <div class="detail-header">
        <button class="btn-icon" data-action="close-detail">${
          icons.chevronLeft
        }</button>
        <div class="detail-header-title">${
          isAudio ? 'Now Listening' : 'Now Reading'
        }</div>
        <div class="detail-header-actions">
          <button class="btn-icon" data-action="set-now-playing" data-book-id="${
            book.id
          }" title="Set as Now Playing">${icons.bookmark}</button>
          <button class="btn-icon" data-action="open-editor-from-detail" data-book-id="${
            book.id
          }" title="Edit">${icons.edit}</button>
        </div>
      </div>

      <div class="detail-body">
        <!-- Hero Section -->
        <div class="detail-hero">
          <div class="detail-hero-cover">
            ${coverHtml}
          </div>
          <div class="detail-hero-info">
            <h1 class="detail-title">${escapeHtml(
              book.title || 'Untitled'
            )}</h1>
            <div class="detail-author">${escapeHtml(
              book.author || 'Unknown Author'
            )}</div>
            ${
              book.narrator
                ? `<div class="detail-narrator">Narrated by ${escapeHtml(
                    book.narrator
                  )}</div>`
                : ''
            }
            ${
              book.series
                ? `<div class="detail-series">${icons.folder} ${escapeHtml(
                    book.series
                  )}</div>`
                : ''
            }
            <div class="detail-status" style="color:${
              statusColors[book.status] || 'var(--text-muted)'
            }">${statusLabel}</div>
            ${stars}
            <div class="detail-meta-pills">${metaPills}</div>
          </div>
        </div>

        <!-- Progress Section -->
        <div class="detail-section">
          <div class="detail-section-header">
            <span>${icons.target} Progress</span>
          </div>
          <div class="detail-progress-section">
            ${progressRing}
            <div class="detail-progress-controls">
              <button class="btn detail-progress-btn" data-action="quick-progress-set" data-book-id="${
                book.id
              }" data-progress="${Math.max(0, progress - 5)}">
                −5%
              </button>
              <button class="btn detail-progress-btn" data-action="quick-progress-set" data-book-id="${
                book.id
              }" data-progress="${Math.min(100, progress + 5)}">
                +5%
              </button>
              <button class="btn detail-progress-btn" data-action="quick-progress-set" data-book-id="${
                book.id
              }" data-progress="${Math.min(100, progress + 10)}">
                +10%
              </button>
              ${
                progress < 100
                  ? `
                <button class="btn btn-primary detail-progress-btn" data-action="mark-finished" data-book-id="${book.id}">
                  ${icons.check} Done
                </button>
              `
                  : ''
              }
            </div>
          </div>
        </div>

        <!-- Audio Player (for audiobooks) -->
        ${isAudio ? AudioPlayer(book, insights) : ''}

        <!-- Reading Insights -->
        ${ReadingInsights(book, insights)}

        ${
          tags
            ? `
        <div class="detail-section">
          <div class="detail-section-header"><span>${icons.tag} Tags</span></div>
          ${tags}
        </div>
        `
            : ''
        }

        <!-- Bookmarks -->
        <div class="detail-section">
          <div class="detail-section-header">
            <span>${icons.bookmark} Bookmarks</span>
            <button class="btn" data-action="add-bookmark" data-book-id="${
              book.id
            }">${icons.plus} Add</button>
          </div>
          <div class="detail-bookmarks">
            ${bookmarkHtml}
          </div>
        </div>

        <!-- Recent Sessions -->
        <div class="detail-section">
          <div class="detail-section-header">
            <span>${icons.clock} Recent Sessions</span>
          </div>
          <div class="detail-sessions">
            ${sessionHtml}
          </div>
        </div>

        ${
          book.description
            ? `
        <div class="detail-section">
          <div class="detail-section-header"><span>${
            icons.bookOpen
          } Description</span></div>
          <div class="detail-description">${escapeHtml(book.description)}</div>
        </div>
        `
            : ''
        }

        ${
          book.notes
            ? `
        <div class="detail-section">
          <div class="detail-section-header"><span>${
            icons.edit
          } Notes</span></div>
          <div class="detail-notes">${escapeHtml(book.notes)}</div>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}
