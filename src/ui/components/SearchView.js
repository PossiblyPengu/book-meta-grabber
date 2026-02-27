import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

export function SearchView(results = [], loading = false) {
  const resultCards = results
    .map(
      (r) => `
      <div class="search-result-card" data-action="add-search-result" data-index="${results.indexOf(
        r
      )}">
        <div class="search-result-cover">
          ${
            r.coverUrl
              ? `<img src="${escapeHtml(r.coverUrl)}" alt="" loading="lazy">`
              : ''
          }
        </div>
        <div class="search-result-info">
          <div class="search-result-title">${escapeHtml(r.title)}</div>
          <div class="search-result-author">${escapeHtml(r.author || '')}</div>
          <div class="search-result-desc">${escapeHtml(
            r.description || ''
          )}</div>
          <div class="search-result-source">${escapeHtml(r.source || '')}</div>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="search-view">
      <h2>Discover</h2>
      <div class="search-bar">
        <input type="text" id="apiSearchInput" placeholder="Search by title, author, or ISBN..."
          data-action="api-search-input">
        <button class="btn btn-primary" data-action="api-search">${
          icons.search
        } Search</button>
      </div>
      ${loading ? '<p style="color:var(--text-muted)">Searching...</p>' : ''}
      <div class="search-results-list">${resultCards}</div>
    </div>
  `;
}
