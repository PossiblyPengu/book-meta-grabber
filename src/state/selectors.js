import { getState } from './store.js';
import { searchBooks } from '../utils/fuzzySearch.js';

const AUDIO_FORMATS = new Set([
  'mp3',
  'm4b',
  'm4a',
  'flac',
  'ogg',
  'opus',
  'audiobook-folder',
]);
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

export function getMediaStats(mediaType) {
  const { books } = getState();
  const filterFn =
    mediaType === 'audiobooks'
      ? (b) => isAudioFormat(b.format)
      : (b) => isEbookFormat(b.format);
  const filtered = books.filter(filterFn);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
  const thisYear = String(now.getFullYear());

  // Parse total listen/read duration from duration strings like "1h 23m"
  let totalMinutes = 0;
  if (mediaType === 'audiobooks') {
    for (const b of filtered) {
      if (b.duration) {
        const hm = b.duration.match(/(\d+)\s*h/);
        const mm = b.duration.match(/(\d+)\s*m/);
        totalMinutes +=
          (hm ? parseInt(hm[1], 10) * 60 : 0) + (mm ? parseInt(mm[1], 10) : 0);
      }
    }
  }

  return {
    total: filtered.length,
    reading: filtered.filter((b) => b.status === 'reading').length,
    finished: filtered.filter((b) => b.status === 'finished').length,
    unread: filtered.filter((b) => b.status === 'unread').length,
    finishedThisMonth: filtered.filter(
      (b) => b.status === 'finished' && b.finishDate?.startsWith(thisMonth)
    ).length,
    finishedThisYear: filtered.filter(
      (b) => b.status === 'finished' && b.finishDate?.startsWith(thisYear)
    ).length,
    totalMinutes,
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

export function getStreakInfo() {
  const { activityLog, settings } = getState();
  const dailyGoal = settings.dailyGoal || 30;
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = activityLog[today];
  const todayMinutes = todayEntry?.minutesRead || 0;

  // Calculate streaks by walking backwards from today
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  const d = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    const entry = activityLog[dateStr];
    if (entry && entry.minutesRead > 0) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      if (i === 0) {
        // Today hasn't been logged yet — don't break streak
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  currentStreak = streak;

  return {
    currentStreak,
    longestStreak,
    todayMinutes,
    dailyGoal,
    todayProgress: Math.min(100, Math.round((todayMinutes / dailyGoal) * 100)),
  };
}

// ── Reading Insights ─────────────────────────────────────────────────────────

export function getBookInsights(bookId) {
  const book = getBookById(bookId);
  if (!book) return null;

  const sessions = book.sessions || [];
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0
  );
  const sessionCount = sessions.length;
  const avgSessionMinutes =
    sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0;

  // Calculate reading pace (% per minute)
  const progress = book.progress || 0;
  const pacePerMinute = totalMinutes > 0 ? progress / totalMinutes : 0;

  // Estimated remaining minutes
  const remaining = 100 - progress;
  const estimatedRemainingMinutes =
    pacePerMinute > 0 ? Math.round(remaining / pacePerMinute) : 0;

  // Estimated finish date based on recent pace
  let estimatedFinishDate = null;
  if (sessionCount >= 2 && pacePerMinute > 0) {
    // Average minutes per day from last 7 sessions
    const recentSessions = sessions.slice(-7);
    const recentDates = recentSessions.map((s) => s.date).filter(Boolean);
    if (recentDates.length >= 2) {
      const first = new Date(recentDates[0]);
      const last = new Date(recentDates[recentDates.length - 1]);
      const daySpan = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
      const recentTotal = recentSessions.reduce(
        (s, r) => s + (r.durationMinutes || 0),
        0
      );
      const minutesPerDay = recentTotal / daySpan;
      if (minutesPerDay > 0) {
        const daysLeft = estimatedRemainingMinutes / minutesPerDay;
        const finish = new Date();
        finish.setDate(finish.getDate() + Math.ceil(daysLeft));
        estimatedFinishDate = finish.toISOString().slice(0, 10);
      }
    }
  }

  // Duration parsing for audiobooks
  let totalDurationMinutes = 0;
  if (book.duration) {
    const parts = book.duration.split(':').map(Number);
    if (parts.length === 3)
      totalDurationMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
    else if (parts.length === 2)
      totalDurationMinutes = parts[0] * 60 + parts[1];
  }

  const listenedMinutes =
    totalDurationMinutes > 0
      ? Math.round(totalDurationMinutes * (progress / 100))
      : 0;
  const remainingListenMinutes =
    totalDurationMinutes > 0
      ? Math.round(totalDurationMinutes * (remaining / 100))
      : 0;

  // Last session info
  const lastSession =
    sessions.length > 0 ? sessions[sessions.length - 1] : null;

  return {
    totalMinutes,
    sessionCount,
    avgSessionMinutes,
    pacePerMinute: Math.round(pacePerMinute * 100) / 100,
    estimatedRemainingMinutes,
    estimatedFinishDate,
    totalDurationMinutes: Math.round(totalDurationMinutes),
    listenedMinutes,
    remainingListenMinutes,
    lastSession,
    progress,
  };
}

export function getCurrentlyReading() {
  const { books, settings } = getState();

  // If there's an explicit now-playing, use that
  if (settings.nowPlayingId) {
    const book = books.find((b) => b.id === settings.nowPlayingId);
    if (book) return book;
  }

  // Otherwise find the most recently active "reading" book
  const reading = books.filter((b) => b.status === 'reading');
  if (reading.length === 0) return null;

  // Sort by most recent session
  return reading.sort((a, b) => {
    const aLast = (a.sessions || []).slice(-1)[0]?.loggedAt || a.addedAt;
    const bLast = (b.sessions || []).slice(-1)[0]?.loggedAt || b.addedAt;
    return new Date(bLast) - new Date(aLast);
  })[0];
}
