import { icons } from '../icons.js';

export function EmptyState(label = 'books') {
  const icon = label === 'audiobooks' ? icons.headphones : icons.book;
  return `
    <div class="empty-state">
      ${icon}
      <h2>No ${label} yet</h2>
      <p>Drop files here, or tap Add to import from your device.</p>
      <button class="btn btn-primary" data-action="add-files">
        ${icons.plus} Add ${label === 'audiobooks' ? 'Audiobooks' : 'Ebooks'}
      </button>
    </div>
  `;
}
