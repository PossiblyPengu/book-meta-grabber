import { icons } from '../icons.js';

export function EmptyState() {
  return `
    <div class="empty-state">
      ${icons.book}
      <h2>No books yet</h2>
      <p>Drop files here, or click Add to import books from your device.</p>
      <button class="btn btn-primary" data-action="add-files">
        ${icons.plus} Add Your First Book
      </button>
    </div>
  `;
}
