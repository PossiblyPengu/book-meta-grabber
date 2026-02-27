/**
 * Fuzzy search scoring. Returns 0 for no match, higher = better.
 * Matches characters in order with gaps allowed.
 */
export function fuzzyScore(query, target) {
  if (!query || !target) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t.includes(q)) return 100 + q.length;

  let score = 0;
  let qi = 0;
  let lastMatch = -1;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      if (ti === lastMatch + 1) {
        consecutive++;
        score += consecutive * 2;
      } else {
        consecutive = 0;
      }
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') {
        score += 5;
      }
      lastMatch = ti;
      qi++;
    }
  }

  return qi === q.length ? score : 0;
}

/**
 * Search a list of books against a query.
 * Returns matches sorted by relevance with { book, score }.
 */
export function searchBooks(books, query) {
  if (!query || !query.trim()) return books.map((b) => ({ book: b, score: 0 }));
  const q = query.trim();

  return books
    .map((book) => {
      const fields = [book.title, book.author, book.series, book.isbn, book.genre];
      const best = Math.max(...fields.map((f) => fuzzyScore(q, f || '')));
      return { book, score: best };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
