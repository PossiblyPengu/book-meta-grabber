import { getState } from '../../state/store.js';
import { icons } from '../icons.js';

export function SettingsView() {
  const { settings } = getState();

  return `
    <div class="settings-page">
      <h2>Settings</h2>

      <div class="settings-section-header">Appearance</div>
      <div class="settings-card">
        <div class="settings-row">
          <label>Theme</label>
          <div class="theme-toggle">
            <button class="theme-toggle-btn ${
              settings.theme === 'light' ? 'active' : ''
            }"
              data-action="set-theme" data-theme="light">
              ${icons.sun} Light
            </button>
            <button class="theme-toggle-btn ${
              settings.theme === 'dark' ? 'active' : ''
            }"
              data-action="set-theme" data-theme="dark">
              ${icons.moon} Dark
            </button>
          </div>
        </div>
        <div class="settings-row">
          <label>Colour</label>
          <div class="color-swatches">
            ${[
              { id: 'violet', color: '#7C3AED', label: 'Violet' },
              { id: 'coral', color: '#F97316', label: 'Coral' },
              { id: 'ocean', color: '#0284C7', label: 'Ocean' },
              { id: 'mint', color: '#059669', label: 'Mint' },
              { id: 'sunset', color: '#DC2626', label: 'Sunset' },
              { id: 'bubblegum', color: '#DB2777', label: 'Bubblegum' },
              { id: 'runner', color: '#FF2D55', label: 'Runner' },
            ]
              .map(
                (t) =>
                  `<button class="color-swatch ${
                    (settings.colorTheme || 'violet') === t.id ? 'active' : ''
                  }" data-action="set-color-theme" data-color="${t.id}"
                    style="--swatch: ${t.color}" title="${t.label}">
                    <span class="color-swatch-dot"></span>
                  </button>`
              )
              .join('')}
          </div>
        </div>
        <div class="settings-row">
          <label>Grid Size</label>
          <div class="theme-toggle">
            ${['small', 'medium', 'large']
              .map(
                (s) =>
                  `<button class="theme-toggle-btn ${
                    settings.gridSize === s ? 'active' : ''
                  }"
                    data-action="set-grid-size" data-size="${s}">${
                    s[0].toUpperCase() + s.slice(1)
                  }</button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="settings-section-header">Library</div>
      <div class="settings-card">
        <div class="settings-btn-group">
          <button class="btn" data-action="import-library">${
            icons.upload
          } Import Library</button>
          <button class="btn" data-action="export-json">${
            icons.download
          } Export JSON</button>
          <button class="btn" data-action="export-csv">${
            icons.download
          } Export CSV</button>
        </div>
      </div>

      <div class="settings-section-header">Reading Goals</div>
      <div class="settings-card">
        <div class="settings-row">
          <label>Daily Goal (minutes)</label>
          <input
            type="number"
            class="editor-input"
            style="width:100px;text-align:center"
            min="5"
            max="480"
            value="${settings.dailyGoal || 30}"
            data-action="set-daily-goal"
          >
        </div>
      </div>

      <div class="settings-section-header">Tools</div>
      <div class="settings-card">
        <div class="settings-btn-group">
          <button class="btn" data-action="enrich-all">${
            icons.zap
          } Enrich All Books</button>
        </div>
      </div>

      <div class="settings-section-header">Danger Zone</div>
      <div class="settings-card">
        <div class="settings-btn-group">
          <button class="btn btn-danger" data-action="clear-library">${
            icons.trash
          } Clear All Books</button>
        </div>
      </div>

      <div class="settings-section-header">About</div>
      <div class="settings-card">
        <p style="padding:var(--sp-md) var(--sp-section);font-size:0.9375rem;color:var(--text-secondary)">
          <strong>Book Meta Grabber v2.0</strong><br>
          Extract and enrich metadata from your book collection.<br>
          Supports EPUB, PDF, MP3, M4B, FLAC, and OGG formats.
        </p>
      </div>
    </div>
  `;
}
