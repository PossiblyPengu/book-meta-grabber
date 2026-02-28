import { getState } from '../../state/store.js';
import { Header } from './Header.js';
import { ShelfSidebar } from './ShelfSidebar.js';
import { Library } from './Library.js';
import { BookEditor } from './BookEditor.js';
import { CommandPalette } from './CommandPalette.js';
import { BulkEnrichment } from './BulkEnrichment.js';
import { SettingsView } from './SettingsView.js';

export function App(covers = {}) {
  const { activeView } = getState();

  const mainContent =
    activeView === 'settings' ? SettingsView() : Library(covers);

  return `
    ${Header()}
    <div class="app-main">${mainContent}</div>
    ${ShelfSidebar()}
    ${BookEditor(covers)}
    ${CommandPalette()}
    ${BulkEnrichment()}
  `;
}
