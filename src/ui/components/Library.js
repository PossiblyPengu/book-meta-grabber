import { getState } from '../../state/store.js';
import { getFilteredBooks } from '../../state/selectors.js';
import { FilterBar } from './FilterBar.js';
import { BookCard } from './BookCard.js';
import { EmptyState } from './EmptyState.js';
import { icons } from '../icons.js';

export function Library(covers = {}, mediaType = 'audiobooks') {
  const { settings, ui } = getState();
  const books = getFilteredBooks(mediaType);

  const label = mediaType === 'audiobooks' ? 'audiobooks' : 'ebooks';

  if (books.length === 0 && !getState().books.length) {
    return EmptyState(label);
  }

  const batchBar =
    ui.selectMode && ui.selectedBookIds.size > 0
      ? `<div class="batch-bar">
          <div class="batch-bar-info"><strong>${ui.selectedBookIds.size}</strong> selected</div>
          <div class="batch-bar-actions">
            <button class="btn" data-action="batch-edit">${icons.edit} Edit</button>
            <button class="btn" data-action="batch-enrich">${icons.zap} Enrich</button>
            <button class="btn" data-action="batch-shelf">${icons.folder} Add to Shelf</button>
            <button class="btn" data-action="batch-export">${icons.download} Export</button>
            <button class="btn btn-danger" data-action="batch-delete">${icons.trash} Delete</button>
            <button class="btn-icon" data-action="clear-selection">${icons.x}</button>
          </div>
        </div>`
      : '';

  const noResults =
    books.length === 0
      ? `<div class="empty-state"><h2>No ${label}</h2><p>Import some ${label} or try changing your filters.</p></div>`
      : '';

  const cards = books
    .map((b) => BookCard(b, { selected: ui.selectedBookIds.has(b.id), covers }))
    .join('');

  return `
    ${FilterBar(mediaType)}
    ${batchBar}
    ${noResults}
    <div class="book-grid" data-size="${
      settings.gridSize || 'medium'
    }">${cards}</div>
  `;
}
