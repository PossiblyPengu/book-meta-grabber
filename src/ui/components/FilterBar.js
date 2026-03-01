import { getState } from '../../state/store.js';
import { StatsCard } from './StatsCard.js';

const AUDIO_FORMATS = [
  { value: 'all', label: 'All' },
  { value: 'mp3', label: 'MP3' },
  { value: 'm4b', label: 'M4B' },
  { value: 'm4a', label: 'M4A' },
  { value: 'flac', label: 'FLAC' },
  { value: 'ogg', label: 'OGG' },
  { value: 'opus', label: 'OPUS' },
];

const EBOOK_FORMATS = [
  { value: 'all', label: 'All' },
  { value: 'epub', label: 'EPUB' },
  { value: 'pdf', label: 'PDF' },
];

export function FilterBar(mediaType = 'audiobooks') {
  const { filters } = getState();
  const formats = mediaType === 'audiobooks' ? AUDIO_FORMATS : EBOOK_FORMATS;

  const chips = formats
    .map(
      (f) =>
        `<button class="filter-chip ${
          filters.format === f.value ? 'active' : ''
        }"
        data-action="set-filter" data-format="${f.value}">${f.label}</button>`
    )
    .join('');

  return `
    ${StatsCard(mediaType)}
    <div class="filter-bar">
      ${chips}
    </div>
  `;
}
