import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

function renderStars(rating) {
  if (!rating) return '';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return `<div class="book-card-stars">${
    '<span class="star-full">★</span>'.repeat(full)
  }${half ? '<span class="star-half">★</span>' : ''}${
    '<span class="star-empty">★</span>'.repeat(empty)
  }</div>`;
}

export function BookCard(book, { selected = false, covers = {} } = {}) {
  const cover = covers[book.id];
  const coverHtml = cover
    ? `<img src="data:${cover.mime};base64,${cover.base64}" alt="" loading="lazy">`
    : `<div class="book-card-placeholder">${icons.book}</div>`;

  const progress =
    book.progress > 0
      ? `<div class="book-card-progress"><div class="book-card-progress-fill" style="width:${book.progress}%"></div></div>`
      : '';

  const fav = book.favorite ? `<span class="book-card-fav">★</span>` : '';

  const stars = renderStars(book.rating);

  const tags = (book.tags && book.tags.length > 0)
    ? `<div class="book-card-tags">${book.tags.slice(0, 2).map(t => `<span class="book-card-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="book-card ${selected ? 'selected' : ''}"
         data-action="open-book" data-book-id="${book.id}">
      <div class="book-card-cover">
        ${coverHtml}
        ${fav}
        <span class="book-card-badge">${escapeHtml(book.format || '')}</span>
        ${progress}
      </div>
      <div class="book-card-info">
        <div class="book-card-title">${escapeHtml(
          book.title || 'Untitled'
        )}</div>
        <div class="book-card-author">${escapeHtml(
          book.author || 'Unknown'
        )}</div>
        ${stars}
        ${tags}
      </div>
    </div>
  `;
}
