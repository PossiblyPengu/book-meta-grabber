import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

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
      </div>
    </div>
  `;
}
