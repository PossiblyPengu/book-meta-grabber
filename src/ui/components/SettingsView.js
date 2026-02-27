import { getState } from '../../state/store.js';
import { icons } from '../icons.js';

export function SettingsView() {
  const { settings } = getState();

  return `
    <div class="settings-page">
      <h2>Settings</h2>

      <div class="settings-card">
        <h3>Appearance</h3>
        <div class="settings-row">
          <label>Theme</label>
          <div class="theme-toggle">
            <button class="theme-toggle-btn ${settings.theme === 'light' ? 'active' : ''}"
              data-action="set-theme" data-theme="light">
              ${icons.sun} Light
            </button>
            <button class="theme-toggle-btn ${settings.theme === 'dark' ? 'active' : ''}"
              data-action="set-theme" data-theme="dark">
              ${icons.moon} Dark
            </button>
          </div>
        </div>
        <div class="settings-row">
          <label>Grid Size</label>
          <div class="theme-toggle">
            ${['small', 'medium', 'large']
              .map(
                (s) =>
                  `<button class="theme-toggle-btn ${settings.gridSize === s ? 'active' : ''}"
                    data-action="set-grid-size" data-size="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3>Library</h3>
        <div class="settings-btn-group">
          <button class="btn" data-action="import-library">${icons.upload} Import Library</button>
          <button class="btn" data-action="export-json">${icons.download} Export JSON</button>
          <button class="btn" data-action="export-csv">${icons.download} Export CSV</button>
        </div>
      </div>

      <div class="settings-card">
        <h3>Tools</h3>
        <div class="settings-btn-group">
          <button class="btn" data-action="enrich-all">${icons.zap} Enrich All Books</button>
        </div>
      </div>

      <div class="settings-card">
        <h3>Danger Zone</h3>
        <div class="settings-btn-group">
          <button class="btn btn-danger" data-action="clear-library">${icons.trash} Clear All Books</button>
        </div>
      </div>

      <div class="settings-card">
        <h3>About</h3>
        <p style="font-size:var(--text-sm);color:var(--text-secondary)">
          <strong>Book Meta Grabber v2.0</strong><br>
          Extract and enrich metadata from your book collection.<br>
          Supports EPUB, PDF, MP3, M4B, FLAC, and OGG formats.
        </p>
      </div>
    </div>
  `;
}
