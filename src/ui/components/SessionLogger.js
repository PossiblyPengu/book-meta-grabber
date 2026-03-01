import { getBookById } from '../../state/selectors.js';
import { icons } from '../icons.js';

export function SessionLogger(bookId) {
  const book = getBookById(bookId);
  if (!book) return '';

  const sessions = book.sessions || [];
  const today = new Date().toISOString().slice(0, 10);

  const historyHtml = sessions
    .slice()
    .reverse()
    .slice(0, 10)
    .map(
      (s) => `
      <div class="session-row">
        <span class="session-date">${s.date || '—'}</span>
        <span class="session-duration">${s.durationMinutes || 0} min</span>
        ${s.notes ? `<span class="session-notes">${s.notes}</span>` : ''}
      </div>`
    )
    .join('');

  return `
    <div class="editor-section-title">Log Session</div>
    <div class="session-form">
      <div class="editor-row">
        <div class="editor-form-group">
          <label class="editor-label">Date</label>
          <input class="editor-input" id="sessionDate" type="date" value="${today}">
        </div>
        <div class="editor-form-group">
          <label class="editor-label">Minutes</label>
          <input class="editor-input" id="sessionMinutes" type="number" min="1" placeholder="30">
        </div>
      </div>
      <div class="editor-form-group">
        <label class="editor-label">Notes</label>
        <input class="editor-input" id="sessionNotes" placeholder="Optional notes...">
      </div>
      <button class="btn" data-action="log-session" data-book-id="${bookId}">
        ${icons.plus} Log Session
      </button>
    </div>
    ${
      sessions.length > 0
        ? `<div class="editor-section-title">Session History (${sessions.length})</div>
           <div class="session-history">${historyHtml}</div>`
        : ''
    }
  `;
}
