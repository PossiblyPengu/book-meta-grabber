import { getState } from './store.js';
import { searchBooks } from '../utils/fuzzySearch.js';

const AUDIO_FORMATS = new Set(['mp3', 'm4b', 'm4a', 'flac', 'ogg', 'opus', 'audiobook-folder']);
const EBOOK_FORMATS = new Set(['epub', 'pdf']);

export function isAudioFormat(format) {
  return AUDIO_FORMATS.has(format);
}

export function isEbookFormat(format) {
  return EBOOK_FORMATS.has(format);
}

export function getFilteredBooks(mediaType) {
  const { books, filters, sort, activeShelfId, shelves } = getState();
  let result = [...books];

  // Filter by media type (audiobooks vs ebooks)
  if (mediaType === 'audiobooks') {
    result = result.filter((b) => isAudioFormat(b.format));
  } else if (mediaType === 'ebooks') {
    result = result.filter((b) => isEbookFormat(b.format));
  }

  // Filter by shelf
  if (activeShelfId) {
    const shelf = shelves.find((s) => s.id === activeShelfId);
    if (shelf) {
      if (shelf.isSystem) {
        const statusMap = {
          'shelf-to-read': 'unread',
          'shelf-reading': 'reading',
          'shelf-finished': 'finished',
        };
        const status = statusMap[shelf.id];
        if (status) result = result.filter((b) => b.status === status);
      } else {
        const bookSet = new Set(shelf.bookIds);
        result = result.filter((b) => bookSet.has(b.id));
      }
    }
  }

  // Filter by format
  if (filters.format && filters.format !== 'all') {
    result = result.filter((b) => b.format === filters.format);
  }

  // Filter by search query
  if (filters.query) {
    result = searchBooks(result, filters.query).map((r) => r.book);
  }

  // Sort
  const dir = sort.order === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    let va = a[sort.by] ?? '';
    let vb = b[sort.by] ?? '';
    if (sort.by === 'progress') return (Number(va) - Number(vb)) * dir;
    if (sort.by === 'addedAt') return (new Date(va) - new Date(vb)) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  return result;
}

export function getStats() {
  const { books } = getState();
  return {
    total: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    finished: books.filter((b) => b.status === 'finished').length,
    unread: books.filter((b) => b.status === 'unread').length,
    favorites: books.filter((b) => b.favorite).length,
  };
}

export function getShelfBooks(shelfId) {
  const { books, shelves } = getState();
  const shelf = shelves.find((s) => s.id === shelfId);
  if (!shelf) return [];

  if (shelf.isSystem) {
    const statusMap = {
      'shelf-to-read': 'unread',
      'shelf-reading': 'reading',
      'shelf-finished': 'finished',
    };
    const status = statusMap[shelf.id];
    return status ? books.filter((b) => b.status === status) : books;
  }

  const bookSet = new Set(shelf.bookIds);
  return books.filter((b) => bookSet.has(b.id));
}

export function getBookById(id) {
  return getState().books.find((b) => b.id === id) || null;
}

export function getSelectedBooks() {
  const { books, ui } = getState();
  return books.filter((b) => ui.selectedBookIds.has(b.id));
}
