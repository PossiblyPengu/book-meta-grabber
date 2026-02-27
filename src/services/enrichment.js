/**
 * Bulk metadata enrichment engine.
 * Processes books one at a time with rate limiting.
 */

import {
  fetchGoogleBooks,
  fetchOpenLibrary,
  fetchItunes,
  fetchMusicBrainz,
} from './apis.js';
import { fuzzyScore } from '../utils/fuzzySearch.js';

let cancelled = false;

export function cancelEnrichment() {
  cancelled = true;
}

/**
 * Enrich an array of books with API metadata.
 * @param {Object[]} books - Books to enrich
 * @param {Object} opts
 * @param {boolean} opts.overwrite - Overwrite existing fields (default false)
 * @param {Function} opts.onProgress - Called with { completed, total, currentTitle, updated, skipped, failed }
 * @param {Function} opts.onBookUpdate - Called with (bookId, updates) to apply changes
 * @returns {Promise<{ updated, skipped, failed }>}
 */
export async function enrichBooks(books, { overwrite = false, onProgress, onBookUpdate } = {}) {
  cancelled = false;
  const results = { updated: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < books.length; i++) {
    if (cancelled) break;
    const book = books[i];

    onProgress?.({
      completed: i,
      total: books.length,
      currentTitle: book.title || book.fileName || '',
      ...results,
    });

    const query = buildQuery(book);
    if (!query) {
      results.skipped++;
      continue;
    }

    try {
      const [g, ol, it, mb] = await Promise.allSettled([
        fetchGoogleBooks(query),
        fetchOpenLibrary(query),
        fetchItunes(query),
        fetchMusicBrainz(query),
      ]);
      const all = [
        ...(g.status === 'fulfilled' ? g.value : []),
        ...(ol.status === 'fulfilled' ? ol.value : []),
        ...(it.status === 'fulfilled' ? it.value : []),
        ...(mb.status === 'fulfilled' ? mb.value : []),
      ];

      const best = pickBest(all, book);
      if (best) {
        const updates = buildUpdates(book, best, overwrite);
        if (Object.keys(updates).length > 0) {
          onBookUpdate?.(book.id, updates);
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        results.skipped++;
      }
    } catch {
      results.failed++;
    }

    // Rate limit: 1 second between books
    if (i < books.length - 1 && !cancelled) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  onProgress?.({
    completed: books.length,
    total: books.length,
    currentTitle: '',
    done: true,
    ...results,
  });

  return results;
}

function buildQuery(book) {
  const parts = [];
  if (book.title) parts.push(book.title);
  if (book.author) parts.push(book.author);
  return parts.join(' ').trim();
}

function pickBest(results, book) {
  if (!results.length) return null;

  let best = null;
  let bestScore = -1;

  for (const r of results) {
    let score = 0;
    if (r.title && book.title) {
      score += fuzzyScore(book.title, r.title) * 0.4;
    }
    if (r.coverUrl) score += 20;
    if (r.isbn) score += 15;
    if (r.description) score += 15;
    // Source reliability bonus
    if (r.source === 'Google Books') score += 10;
    else if (r.source === 'Open Library') score += 8;
    else if (r.source === 'iTunes / Audible') score += 6;

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return bestScore > 10 ? best : null;
}

function buildUpdates(book, match, overwrite) {
  const updates = {};
  const fields = ['title', 'author', 'narrator', 'publisher', 'year', 'isbn', 'description', 'genre', 'language'];

  for (const field of fields) {
    const val = match[field];
    if (!val) continue;
    if (overwrite || !book[field]) {
      updates[field] = val;
    }
  }

  // Cover URL → stored separately, signal via coverUrl
  if (match.coverUrl && (overwrite || !book.hasCover)) {
    updates.coverUrl = match.coverUrl;
  }

  return updates;
}
