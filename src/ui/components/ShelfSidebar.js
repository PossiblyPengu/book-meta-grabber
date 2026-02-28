import { icons } from '../icons.js';
import { getState } from '../../state/store.js';

export function ShelfSidebar() {
  const { activeView } = getState();

  const tabs = [
    { view: 'library', icon: icons.book, label: 'Library' },
    { view: 'settings', icon: icons.settings, label: 'Settings' },
  ];

  return `
    <nav class="tab-bar" aria-label="Main navigation">
      ${tabs
        .map(
          (t) => `
          <button class="tab-button ${activeView === t.view ? 'active' : ''}"
            data-action="nav" data-view="${t.view}" aria-label="${t.label} tab">
            ${t.icon}
            <span class="tab-label">${t.label}</span>
          </button>`
        )
        .join('')}
    </nav>
  `;
}
