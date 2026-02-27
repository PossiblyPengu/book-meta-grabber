import { getState } from '../../state/store.js';
import { getStats } from '../../state/selectors.js';

const FORMATS = [
  { value: 'all', label: 'All' },
  { value: 'epub', label: 'EPUB' },
  { value: 'pdf', label: 'PDF' },
  { value: 'mp3', label: 'MP3' },
  { value: 'm4b', label: 'M4B' },
  { value: 'flac', label: 'FLAC' },
  { value: 'ogg', label: 'OGG' },
];

export function FilterBar() {
  const { filters } = getState();
  const stats = getStats();

  const chips = FORMATS.map(
    (f) =>
      `<button class="filter-chip ${filters.format === f.value ? 'active' : ''}"
        data-action="set-filter" data-format="${f.value}">${f.label}</button>`
  ).join('');

  return `
    <div class="stats-bar">
      <div class="stat-item"><span>Total</span> <span class="stat-value">${stats.total}</span></div>
      <div class="stat-item"><span>Reading</span> <span class="stat-value">${stats.reading}</span></div>
      <div class="stat-item"><span>Finished</span> <span class="stat-value">${stats.finished}</span></div>
    </div>
    <div class="filter-bar">
      ${chips}
    </div>
  `;
}
