/**
 * src/apis/index.js
 * Client-safe API fetchers — runs in Capacitor WebView / browser.
 * Uses fetch() only (no axios/Node).
 */

const TIMEOUT_MS = 9000;

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id    = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(id));
}

// ─── Google Books ─────────────────────────────────────────────────────────────
export async function fetchGoogleBooks(query) {
  try {
    const r = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`
    );
    const data = await r.json();
    return (data.items || []).map(item => {
      const v = item.volumeInfo || {};
      const imgs = v.imageLinks || {};
      const prefer = ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail'];
      const coverUrl = prefer.map(p => imgs[p]).find(Boolean) || null;
      return {
        source:      'Google Books',
        title:       v.title || '',
        author:      (v.authors || []).join(', '),
        publisher:   v.publisher || '',
        year:        (v.publishedDate || '').slice(0, 4),
        isbn:        (v.industryIdentifiers || []).find(i => i.type === 'ISBN_13')?.identifier || '',
        description: stripHtml(v.description || ''),
        genre:       (v.categories || []).join(', '),
        language:    v.language || '',
        coverUrl,
      };
    });
  } catch { return []; }
}

// ─── Open Library ─────────────────────────────────────────────────────────────
export async function fetchOpenLibrary(query) {
  try {
    const r    = await fetchWithTimeout(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
    const data = await r.json();
    return (data.docs || []).slice(0, 5).map(doc => ({
      source:    'Open Library',
      title:     doc.title || '',
      author:    (doc.author_name || []).join(', '),
      publisher: (doc.publisher || []).join(', ').slice(0, 80),
      year:      doc.first_publish_year ? String(doc.first_publish_year) : '',
      isbn:      (doc.isbn || [])[0] || '',
      language:  (doc.language || [])[0] || '',
      genre:     (doc.subject || []).slice(0, 3).join(', '),
      coverUrl:  doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    }));
  } catch { return []; }
}

// ─── iTunes / Apple Books ─────────────────────────────────────────────────────
export async function fetchItunes(query) {
  try {
    const q  = encodeURIComponent(query);
    const [abRes, ebRes] = await Promise.allSettled([
      fetchWithTimeout(`https://itunes.apple.com/search?term=${q}&media=audiobook&limit=4&entity=audiobook`).then(r => r.json()),
      fetchWithTimeout(`https://itunes.apple.com/search?term=${q}&media=ebook&limit=3&entity=ebook`).then(r => r.json()),
    ]);
    const ab = abRes.status === 'fulfilled' ? abRes.value.results || [] : [];
    const eb = ebRes.status === 'fulfilled' ? ebRes.value.results || [] : [];
    return [...ab, ...eb].slice(0, 6).map(item => ({
      source:      'iTunes / Audible',
      title:       item.collectionName || item.trackName || '',
      author:      item.artistName || '',
      narrator:    item.authorName || '',
      publisher:   item.publisherName || '',
      year:        (item.releaseDate || '').slice(0, 4),
      description: stripHtml(item.description || item.longDescription || ''),
      genre:       item.primaryGenreName || '',
      coverUrl:    (() => {
        const url = item.artworkUrl600 || item.artworkUrl100 || item.artworkUrl60 || '';
        if (!url) return null;
        return url.replace(/(\d+)x(\d+)(bb)?/i, '1000x1000$3');
      })(),
    }));
  } catch { return []; }
}

// ─── MusicBrainz ─────────────────────────────────────────────────────────────
export async function fetchMusicBrainz(query) {
  try {
    const r    = await fetchWithTimeout(
      `https://musicbrainz.org/ws/2/release/?query=release:${encodeURIComponent(`"${query}"`)}&limit=5&fmt=json`,
      { headers: { 'User-Agent': 'BookMetaGrabber/1.0 (https://github.com)' } }
    );
    const data = await r.json();
    const rels  = data.releases || [];
    const results = [];
    for (const rel of rels.slice(0, 4)) {
      let coverUrl = null;
      try {
        const cr   = await fetchWithTimeout(`https://coverartarchive.org/release/${rel.id}`, { headers: { Accept: 'application/json' } });
        const crd  = await cr.json();
        const img = crd?.images?.[0] || null;
        coverUrl = img?.thumbnails?.large || img?.thumbnails?.['500'] || img?.image || null;
      } catch {}
      results.push({
        source:    'MusicBrainz',
        title:     rel.title || '',
        author:    rel['artist-credit']?.map(a => a.artist?.name).join(', ') || '',
        year:      (rel.date || '').slice(0, 4),
        publisher: rel['label-info']?.[0]?.label?.name || '',
        coverUrl,
      });
    }
    return results;
  } catch { return []; }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────
export async function fetchAll(query) {
  const [g, ol, it, mb] = await Promise.allSettled([
    fetchGoogleBooks(query),
    fetchOpenLibrary(query),
    fetchItunes(query),
    fetchMusicBrainz(query),
  ]);
  return [
    ...(g.status  === 'fulfilled' ? g.value  : []),
    ...(ol.status === 'fulfilled' ? ol.value : []),
    ...(it.status === 'fulfilled' ? it.value : []),
    ...(mb.status === 'fulfilled' ? mb.value : []),
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
