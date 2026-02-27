import { icons } from '../icons.js';
import { getState } from '../../state/store.js';

export function Header() {
  const { filters, ui } = getState();
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
        <span class="header-search-kbd">Ctrl+K</span>
      </div>
      <div class="header-actions">
        <button class="btn-icon" data-action="toggle-sort" aria-label="Sort">${icons.sort}</button>
        <button class="btn-icon" data-action="cycle-grid" aria-label="Grid size">${icons.grid}</button>
        <button class="btn-icon" data-action="toggle-select" aria-label="Select mode"
          ${ui.selectMode ? 'style="color:var(--accent)"' : ''}>
          ${icons.check}
        </button>
        <button class="btn btn-primary" data-action="add-files">
          ${icons.plus} Add
        </button>
        <button class="btn btn-primary" data-action="add-folder" aria-label="Import folder">
          ${icons.folder}
        </button>
      </div>
    </div>
  `;
}
