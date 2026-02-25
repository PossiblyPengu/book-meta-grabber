# 📚 Book Meta Grabber — Web

Web-first app for fetching and editing metadata + cover art for ebooks and audiobooks.
Built with vanilla JS, styled with a lightweight glass aesthetic.

---

## Supported Formats

| Format | Metadata Read | Cover Read |
|--------|:---:|:---:|
| EPUB   | ✅ OPF/DCTerms | ✅ |
| PDF    | ✅ PDF Info dict | — |
| MP3    | ✅ ID3v2 | ✅ |
| M4B / M4A | ✅ iTunes atoms | ✅ |
| FLAC   | ✅ Vorbis comments | ✅ |
| OGG    | ✅ Vorbis comments | ✅ |

## File Sources

| Source | Method |
|--------|--------|
| **Local Storage** | Capacitor Document Picker → native iOS Files sheet |
| **iCloud Drive** | Same picker — iCloud Drive appears automatically in Files |
| **Google Drive** | OAuth2 in-app browser → Google Picker → download via Drive API |

### Folder / Audiobook import

You can import directories containing audiobook parts (multiple audio files in a folder). On platforms that support directory selection the app will group files by top-level folder and present an "Import Folder" option. When importing a multi-part audiobook you can:

- Import as a multi-part entry (keeps parts separate in the library), or
- Concatenate parts into a single M4B file in the browser using FFmpeg.wasm (re-encodes to AAC). This can be slow and memory-heavy — the app will fall back to importing parts if concatenation fails.

The browser fallback uses `input.webkitdirectory` (Chrome/Edge) when native directory picking isn't available.

## Metadata Sources (All queried in parallel)

- Google Books API
- Open Library (OpenLibrary.org)
- iTunes / Apple Books API
- MusicBrainz + Cover Art Archive

---

## Setup

1. Install dependencies

```bash
npm install
```

2. Build web assets

```bash
npm run build
```

---

## Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create an OAuth 2.0 Client ID for iOS
3. Add your bundle ID `com.andrew.bookmetagrabber`
4. Paste the Client ID in the app's **Settings** tab

---

## Project Structure

```
book-meta-grabber/
├── index.html               ← Web app shell (Library / Search / Settings)
├── vite.config.js          ← Vite build config (builds root → dist/)
├── src/
│   ├── apis/index.js       ← Google Books, Open Library, iTunes, MusicBrainz
│   ├── extractors/index.js ← Browser-safe EPUB/PDF/audio parsers (CDN libs)
│   ├── fileSources.js      ← Local picker, Google Drive OAuth
+│   └── storage.js          ← Persistence wrapper (localStorage / Preferences)
└── README.md
```

## UX Highlights

- **Bottom tab bar** with spring-animated tab switching (Library / Search / Settings)
- **Source picker bottom sheet** with iOS spring physics (`cubic-bezier(0.34,1.2,0.64,1)`)
- **Full-screen editor** slides up from bottom with blurred cover art hero
- **Cover art bleeds** edge-to-edge behind a gradient overlay — album-art style
- **Results half-sheet** drags up to reveal search results without leaving the editor
- **Haptic feedback** on every meaningful interaction via `@capacitor/haptics`
- **Safe area insets** everywhere (`env(safe-area-inset-*)`) for Dynamic Island and home indicator
- **44pt minimum touch targets** throughout
- **Auto-fetch** enriches metadata from APIs automatically on import
