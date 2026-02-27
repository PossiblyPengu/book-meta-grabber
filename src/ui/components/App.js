import { getState } from '../../state/store.js';
import { Header } from './Header.js';
import { ShelfSidebar } from './ShelfSidebar.js';
import { Library } from './Library.js';
import { BookEditor } from './BookEditor.js';
import { CommandPalette } from './CommandPalette.js';
import { BulkEnrichment } from './BulkEnrichment.js';
import { SearchView } from './SearchView.js';
import { SettingsView } from './SettingsView.js';

export function App(covers = {}, searchState = {}) {
  const { activeView } = getState();

  let mainContent;
  switch (activeView) {
    case 'search':
      mainContent = SearchView(searchState.results || [], searchState.loading);
      break;
    case 'settings':
      mainContent = SettingsView();
      break;
    default:
      mainContent = Library(covers);
      break;
  }

  return `
    ${ShelfSidebar()}
    ${Header()}
    <div class="app-main">${mainContent}</div>
    ${BookEditor(covers)}
    ${CommandPalette()}
    ${BulkEnrichment()}
  `;
}
