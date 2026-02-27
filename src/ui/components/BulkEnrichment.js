import { getState } from '../../state/store.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

export function BulkEnrichment() {
  const { ui } = getState();
  const e = ui.bulkEnrichment;
  if (!e) return '';

  const pct = e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0;

  if (e.done) {
    return `
      <div class="enrichment-bar">
        <div class="enrichment-header">
          <div>
            <div class="enrichment-title">Enrichment Complete</div>
            <div class="enrichment-subtitle">
              ${e.updated} updated, ${e.skipped} skipped, ${e.failed} failed
            </div>
          </div>
          <button class="btn-icon" data-action="dismiss-enrichment">${icons.x}</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="enrichment-bar">
      <div class="enrichment-header">
        <div>
          <div class="enrichment-title">Enriching metadata...</div>
          <div class="enrichment-subtitle">${e.completed} of ${e.total} books</div>
        </div>
        <button class="btn" data-action="cancel-enrichment">${icons.x} Cancel</button>
      </div>
      <div class="enrichment-progress">
        <div class="enrichment-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="enrichment-status">${escapeHtml(e.currentTitle || '')}</div>
    </div>
  `;
}
