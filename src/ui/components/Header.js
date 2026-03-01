import { icons } from '../icons.js';
import { getState } from '../../state/store.js';
import { getStreakInfo } from '../../state/selectors.js';

export function Header() {
  const { filters, ui, activeView } = getState();

  // Only show header on audiobooks/ebooks views
  if (activeView !== 'audiobooks' && activeView !== 'ebooks') return '';

  const placeholder =
    activeView === 'audiobooks' ? 'Search audiobooks...' : 'Search ebooks...';

  const streak = getStreakInfo();
  const streakHtml =
    streak.currentStreak > 0
      ? `<div class="streak-indicator" title="${streak.todayMinutes}/${streak.dailyGoal} min today">
           <span class="streak-fire">${icons.flame}</span>
           <span class="streak-count">${streak.currentStreak}</span>
         </div>`
      : '';

  return `
    <div class="app-header">
      ${streakHtml}
      <div class="header-search">
        <input
          type="text"
          class="header-search-input"
          placeholder="${placeholder}"
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
        <button class="btn-icon btn-primary-icon" data-action="add-files" aria-label="Add files">
          ${icons.plus}
        </button>
      </div>
    </div>
  `;
}
