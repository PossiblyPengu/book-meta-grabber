import { getState } from '../../state/store.js';
import { Header } from './Header.js';
import { ShelfSidebar } from './ShelfSidebar.js';
import { Library } from './Library.js';
import { BookEditor } from './BookEditor.js';
import { CommandPalette } from './CommandPalette.js';
import { BulkEnrichment } from './BulkEnrichment.js';
import { BatchEditor } from './BatchEditor.js';
import { SettingsView } from './SettingsView.js';
import { ReadingStats } from './ReadingStats.js';
import { NowPlayingBar } from './NowPlayingBar.js';
import { BookDetailView } from './BookDetailView.js';

export function App(covers = {}) {
  const { activeView } = getState();

  let mainContent;
  if (activeView === 'settings') {
    mainContent = SettingsView();
  } else if (activeView === 'stats') {
    mainContent = ReadingStats();
  } else {
    mainContent = Library(covers, activeView);
  }

  return `
    ${Header()}
    <div class="app-main">${mainContent}</div>
    ${NowPlayingBar(covers)}
    ${ShelfSidebar()}
    ${BookEditor(covers)}
    ${BookDetailView(covers)}
    ${BatchEditor()}
    ${CommandPalette()}
    ${BulkEnrichment()}
  `;
}
