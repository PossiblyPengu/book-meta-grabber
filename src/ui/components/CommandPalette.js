import { getState } from '../../state/store.js';
import { searchBooks } from '../../utils/fuzzySearch.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

export function CommandPalette() {
  const { ui } = getState();
  if (!ui.commandPaletteOpen) return '';

  return `
    <div class="command-palette-overlay" data-action="close-command-palette">
      <div class="command-palette" data-stop-propagation>
        <input
          class="command-palette-input"
          id="commandPaletteInput"
          placeholder="Search books, run actions..."
          autofocus
          data-action="command-palette-search"
        >
        <div class="command-palette-results" id="commandPaletteResults">
          ${renderQuickActions()}
        </div>
      </div>
    </div>
  `;
}

export function renderCommandPaletteResults(query) {
  if (!query || !query.trim()) return renderQuickActions();

  const { books } = getState();
  const matches = searchBooks(books, query).slice(0, 8);

  // Check if it looks like an ISBN
  const isbnLike = /^\d{10}(\d{3})?$/.test(query.trim());

  let html = '';

  if (matches.length > 0) {
    html += `<div class="command-palette-section">Books</div>`;
    html += matches
      .map(
        ({ book }) => `
        <div class="command-palette-item" data-action="command-open-book" data-book-id="${
          book.id
        }">
          <span class="command-palette-item-icon">${icons.book}</span>
          <span class="command-palette-item-text">${escapeHtml(
            book.title
          )}</span>
          <span class="command-palette-item-hint">${escapeHtml(
            book.author || ''
          )}</span>
        </div>`
      )
      .join('');
  }

  html += `<div class="command-palette-section">Actions</div>`;

  if (isbnLike) {
    html += `
      <div class="command-palette-item" data-action="command-isbn-lookup" data-isbn="${escapeHtml(
        query.trim()
      )}">
        <span class="command-palette-item-icon">${icons.search}</span>
        <span class="command-palette-item-text">Look up ISBN ${escapeHtml(
          query.trim()
        )}</span>
      </div>`;
  }

  html += `
    <div class="command-palette-item" data-action="command-search-apis" data-query="${escapeHtml(
      query
    )}">
      <span class="command-palette-item-icon">${icons.search}</span>
      <span class="command-palette-item-text">Search APIs for "${escapeHtml(
        query
      )}"</span>
    </div>`;

  return html;
}

function renderQuickActions() {
  return `
    <div class="command-palette-section">Quick Actions</div>
    <div class="command-palette-item" data-action="add-files">
      <span class="command-palette-item-icon">${icons.plus}</span>
      <span class="command-palette-item-text">Add books</span>
      <span class="command-palette-item-hint">Ctrl+N</span>
    </div>
    <div class="command-palette-item" data-action="nav" data-view="search">
      <span class="command-palette-item-icon">${icons.search}</span>
      <span class="command-palette-item-text">Discover books</span>
    </div>
    <div class="command-palette-item" data-action="toggle-theme">
      <span class="command-palette-item-icon">${icons.moon}</span>
      <span class="command-palette-item-text">Toggle theme</span>
      <span class="command-palette-item-hint">Ctrl+D</span>
    </div>
    <div class="command-palette-item" data-action="nav" data-view="settings">
      <span class="command-palette-item-icon">${icons.settings}</span>
      <span class="command-palette-item-text">Settings</span>
    </div>
  `;
}
