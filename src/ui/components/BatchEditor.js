import { getState } from '../../state/store.js';
import { icons } from '../icons.js';

export function BatchEditor() {
  const { ui } = getState();
  const open = ui.batchEditorOpen && ui.selectedBookIds.size > 0;

  if (!open) {
    return `<div class="editor-overlay"></div><div class="editor-panel"></div>`;
  }

  const count = ui.selectedBookIds.size;

  return `
    <div class="editor-overlay open" data-action="close-batch-editor"></div>
    <div class="editor-panel open">
      <div class="editor-drag-handle"></div>
      <div class="editor-header">
        <h2>Edit ${count} Book(s)</h2>
        <div class="editor-header-actions">
          <button class="btn btn-primary" data-action="batch-edit-save">${icons.check} Apply</button>
          <button class="btn-icon" data-action="close-batch-editor">${icons.x}</button>
        </div>
      </div>
      <div class="editor-body">
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:var(--sp-md)">
          Only non-empty fields will be applied to the selected books.
        </p>
        <div class="editor-form-group">
          <label class="editor-label">Status</label>
          <select class="editor-select" id="batchStatus">
            <option value="">— No change —</option>
            <option value="unread">Unread</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Genre</label>
          <input class="editor-input" id="batchGenre" placeholder="Leave empty to skip">
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Series</label>
          <input class="editor-input" id="batchSeries" placeholder="Leave empty to skip">
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Progress (%)</label>
          <input class="editor-input" id="batchProgress" type="number" min="0" max="100" placeholder="Leave empty to skip">
        </div>
      </div>
    </div>
  `;
}
