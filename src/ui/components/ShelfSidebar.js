import { icons } from '../icons.js';
import { getState } from '../../state/store.js';
import { getShelfBooks } from '../../state/selectors.js';

export function ShelfSidebar() {
  const { shelves, activeShelfId, activeView } = getState();

  const shelfItems = shelves
    .map((s) => {
      const count = s.id === 'shelf-all' ? getState().books.length : getShelfBooks(s.id).length;
      const active = activeShelfId === s.id || (!activeShelfId && s.id === 'shelf-all');
      return `
        <div class="shelf-item ${active ? 'active' : ''}" data-action="select-shelf" data-shelf-id="${s.id}">
          <span class="shelf-dot" style="background:${s.color}"></span>
          <span class="truncate">${s.name}</span>
          <span class="shelf-count">${count}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="app-sidebar">
      <div class="sidebar-brand">
        <h1>Book Meta Grabber</h1>
        <span>v2.0</span>
      </div>

      <div class="sidebar-section-title">Library</div>
      ${shelfItems}

      <button class="shelf-create-btn" data-action="create-shelf">
        ${icons.plus}
        <span>New Shelf</span>
      </button>

      <div class="sidebar-nav">
        <div class="nav-item ${activeView === 'search' ? 'active' : ''}" data-action="nav" data-view="search">
          ${icons.search}
          <span>Discover</span>
        </div>
        <div class="nav-item ${activeView === 'settings' ? 'active' : ''}" data-action="nav" data-view="settings">
          ${icons.settings}
          <span>Settings</span>
        </div>
      </div>
    </div>
  `;
}
