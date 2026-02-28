import { icons } from '../icons.js';
import { getState } from '../../state/store.js';

export function Header() {
  const { filters, ui, activeView } = getState();

  // Only show header on library view
  if (activeView !== 'library') return '';

  return `
    <div class="app-header">
      <div class="header-search">
        <input
          type="text"
          class="header-search-input"
          placeholder="Search library..."
          value="${filters.query || ''}"
          data-action="search-input"
        >
      </div>
      <div class="header-actions">
        <button class="btn-icon" data-action="toggle-sort" aria-label="Sort">${
          icons.sort
        }</button>
        <button class="btn-icon" data-action="toggle-select" aria-label="Select mode"
          ${ui.selectMode ? 'style="color:var(--primary-light)"' : ''}>
          ${icons.check}
        </button>
        <button class="btn-icon btn-primary-icon" data-action="add-files" aria-label="Add books">
          ${icons.plus}
        </button>
      </div>
    </div>
  `;
}
