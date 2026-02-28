import { getState } from '../../state/store.js';
import { getBookById } from '../../state/selectors.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icons } from '../icons.js';

export function BookEditor(covers = {}) {
  const { ui, shelves } = getState();
  const book = ui.editorBookId ? getBookById(ui.editorBookId) : null;
  const open = !!book;

  if (!open) {
    return `<div class="editor-overlay"></div><div class="editor-panel"></div>`;
  }

  const cover = covers[book.id];
  const coverHtml = cover
    ? `<img src="data:${cover.mime};base64,${cover.base64}" alt="">`
    : `<div class="book-card-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${icons.image}</div>`;

  const isAudio = ['mp3', 'm4b', 'm4a', 'flac', 'ogg', 'opus'].includes(
    book.format
  );

  // Shelf pills
  const customShelves = shelves.filter((s) => !s.isSystem);
  const shelfPills = customShelves
    .map((s) => {
      const active = s.bookIds.includes(book.id);
      return `<button class="shelf-pill ${active ? 'active' : ''}"
        data-action="toggle-book-shelf" data-shelf-id="${s.id}"
        data-book-id="${book.id}">${s.name}</button>`;
    })
    .join('');

  return `
    <div class="editor-overlay ${
      open ? 'open' : ''
    }" data-action="close-editor"></div>
    <div class="editor-panel ${open ? 'open' : ''}">
      <div class="editor-drag-handle"></div>
      <div class="editor-header">
        <h2>Edit Metadata</h2>
        <div class="editor-header-actions">
          <button class="btn" data-action="editor-search">${
            icons.search
          } Enrich</button>
          <button class="btn btn-primary" data-action="editor-save">${
            icons.check
          } Save</button>
          <button class="btn-icon" data-action="close-editor">${
            icons.x
          }</button>
        </div>
      </div>
      <div class="editor-body">
        <div class="editor-cover" data-action="change-cover">
          ${coverHtml}
          <div class="editor-cover-overlay">Change Cover</div>
        </div>
        <input type="file" id="coverFileInput" accept="image/*" class="hidden">

        <div class="editor-search-results" id="editorSearchResults"></div>

        <div class="editor-form-group">
          <label class="editor-label">Title</label>
          <input class="editor-input" id="editTitle" value="${escapeHtml(
            book.title
          )}" placeholder="Book title">
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Author</label>
          <input class="editor-input" id="editAuthor" value="${escapeHtml(
            book.author
          )}" placeholder="Author name">
        </div>
        <div class="editor-row">
          <div class="editor-form-group">
            <label class="editor-label">Narrator</label>
            <input class="editor-input" id="editNarrator" value="${escapeHtml(
              book.narrator || ''
            )}" placeholder="Narrator">
          </div>
          <div class="editor-form-group">
            <label class="editor-label">Series</label>
            <input class="editor-input" id="editSeries" value="${escapeHtml(
              book.series || ''
            )}" placeholder="Series">
          </div>
        </div>
        <div class="editor-row">
          <div class="editor-form-group">
            <label class="editor-label">Year</label>
            <input class="editor-input" id="editYear" value="${escapeHtml(
              book.year || ''
            )}" placeholder="2024">
          </div>
          <div class="editor-form-group">
            <label class="editor-label">Publisher</label>
            <input class="editor-input" id="editPublisher" value="${escapeHtml(
              book.publisher || ''
            )}" placeholder="Publisher">
          </div>
        </div>
        <div class="editor-row">
          <div class="editor-form-group">
            <label class="editor-label">Genre</label>
            <input class="editor-input" id="editGenre" value="${escapeHtml(
              book.genre || ''
            )}" placeholder="Genre">
          </div>
          <div class="editor-form-group">
            <label class="editor-label">ISBN</label>
            <input class="editor-input" id="editIsbn" value="${escapeHtml(
              book.isbn || ''
            )}" placeholder="978-...">
          </div>
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Language</label>
          <select class="editor-select" id="editLanguage">
            ${langOptions(book.language || 'en')}
          </select>
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Description</label>
          <textarea class="editor-textarea" id="editDescription" rows="4" placeholder="Description">${escapeHtml(
            book.description || ''
          )}</textarea>
        </div>

        ${
          isAudio
            ? `<div class="editor-section-title">Audio Info</div>
               <div class="editor-row">
                 <div class="editor-form-group">
                   <label class="editor-label">Duration</label>
                   <input class="editor-input" id="editDuration" value="${escapeHtml(
                     book.duration || ''
                   )}" readonly>
                 </div>
                 <div class="editor-form-group">
                   <label class="editor-label">Bitrate</label>
                   <input class="editor-input" id="editBitrate" value="${escapeHtml(
                     book.bitrate || ''
                   )}" readonly>
                 </div>
               </div>`
            : ''
        }

        <div class="editor-section-title">Reading Progress</div>
        <div class="editor-row">
          <div class="editor-form-group">
            <label class="editor-label">Status</label>
            <select class="editor-select" id="editStatus">
              <option value="unread" ${
                book.status === 'unread' ? 'selected' : ''
              }>Unread</option>
              <option value="reading" ${
                book.status === 'reading' ? 'selected' : ''
              }>Reading</option>
              <option value="finished" ${
                book.status === 'finished' ? 'selected' : ''
              }>Finished</option>
              <option value="abandoned" ${
                book.status === 'abandoned' ? 'selected' : ''
              }>Abandoned</option>
            </select>
          </div>
          <div class="editor-form-group">
            <label class="editor-label">Progress (%)</label>
            <input class="editor-input" id="editProgress" type="number" min="0" max="100" value="${
              book.progress || 0
            }">
          </div>
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Current Page / Chapter</label>
          <input class="editor-input" id="editCurrentPage" value="${escapeHtml(
            book.currentPage || ''
          )}" placeholder="Page 1">
        </div>
        <div class="editor-row">
          <div class="editor-form-group">
            <label class="editor-label">Started</label>
            <input class="editor-input" id="editStartDate" type="date" value="${
              book.startDate || ''
            }">
          </div>
          <div class="editor-form-group">
            <label class="editor-label">Finished</label>
            <input class="editor-input" id="editFinishDate" type="date" value="${
              book.finishDate || ''
            }">
          </div>
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Notes</label>
          <textarea class="editor-textarea" id="editNotes" rows="3" placeholder="Personal notes...">${escapeHtml(
            book.notes || ''
          )}</textarea>
        </div>

        ${
          customShelves.length > 0
            ? `<div class="editor-section-title">Shelves</div>
               <div class="shelf-pills">${shelfPills}</div>`
            : ''
        }
      </div>
    </div>
  `;
}

function langOptions(selected) {
  const langs = [
    ['en', 'English'],
    ['es', 'Spanish'],
    ['fr', 'French'],
    ['de', 'German'],
    ['it', 'Italian'],
    ['pt', 'Portuguese'],
    ['ru', 'Russian'],
    ['ja', 'Japanese'],
    ['zh', 'Chinese'],
    ['ko', 'Korean'],
    ['ar', 'Arabic'],
    ['hi', 'Hindi'],
  ];
  return langs
    .map(
      ([v, l]) =>
        `<option value="${v}" ${selected === v ? 'selected' : ''}>${l}</option>`
    )
    .join('');
}
