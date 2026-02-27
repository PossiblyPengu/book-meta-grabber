/**
 * src/utils/filenameParser.js
 * Heuristics to extract Title, Author, Series, Year from filenames.
 */

export function parseFileName(fileName) {
  if (!fileName) return { title: '', author: '', series: '', year: '' };

  // Remove file extension and common release group patterns
  let cleaned = fileName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[\[\](){}]/g, ' ') // Remove brackets
    .replace(/[._-]/g, ' ') // Replace dots, underscores, hyphens with spaces
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .trim();

  // Common patterns to detect and extract metadata - ORDER MATTERS (most specific first)
  const patterns = [
    // Year in parentheses: "Title (Year)" or "Title by Author (Year)"
    {
      regex: /^(.+?)\s*\((\d{4})\)\s*(?:by\s*(.+))?$/i,
      handler: (match, title, year, author) => ({
        title: title.trim(),
        author: author ? author.trim() : '',
        series: '',
        year: year
      })
    },
    // Series patterns with book number: "Series Name Book 1" or "Series Name #1"
    {
      regex: /^(.+?)(?:\s+(?:book|#)\s*(\d+))\s*(?:by\s*(.+))?$/i,
      handler: (match, series, seriesNum, author) => ({
        title: `${series.trim()} #${seriesNum}`,
        series: `${series.trim()} #${seriesNum}`,
        author: author ? author.trim() : '',
        year: ''
      })
    },
    // Author - Title pattern (only if first part looks like a name)
    {
      regex: /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[-–—]\s*(.+?)(?:\s*\((\d{4})\))?$/,
      handler: (match, author, title, year) => ({
        title: title.trim(),
        author: author.trim(),
        series: '',
        year: year || ''
      })
    },
    // Title - Author pattern (only if second part looks like a name)
    {
      regex: /^(.+?)\s*[-–—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/,
      handler: (match, title, author) => ({
        title: title.trim(),
        author: author.trim(),
        series: '',
        year: ''
      })
    }
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = cleaned.match(pattern.regex);
    if (match) {
      const result = pattern.handler(match, ...match.slice(1));
      if (result && isValidResult(result)) return result;
    }
  }

  // Fallback: try to detect if there are multiple parts
  const parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length === 2) {
    const [part1, part2] = parts;
    
    // Check if part2 looks like an author (2-3 words, each capitalized, no numbers)
    const part2Words = part2.trim().split(/\s+/);
    const looksLikeAuthor = part2Words.length >= 1 && 
                           part2Words.length <= 3 && 
                           part2Words.every(w => /^[A-Z][a-z]*$/.test(w)) &&
                           !/\d/.test(part2);
    
    // Check if part1 is longer (likely a title)
    if (part1.length > part2.length && looksLikeAuthor) {
      return {
        title: part1.trim(),
        author: part2.trim(),
        series: '',
        year: ''
      };
    }
    
    // Check if part1 looks like an author
    const part1Words = part1.trim().split(/\s+/);
    const part1LooksLikeAuthor = part1Words.length >= 1 && 
                                 part1Words.length <= 3 && 
                                 part1Words.every(w => /^[A-Z][a-z]*$/.test(w)) &&
                                 !/\d/.test(part1);
    
    if (part2.length > part1.length && part1LooksLikeAuthor) {
      return {
        title: part2.trim(),
        author: part1.trim(),
        series: '',
        year: ''
      };
    }
  }

  // Last resort: treat everything as title
  return {
    title: cleaned,
    author: '',
    series: '',
    year: ''
  };
}

// Helper to validate parsed results
function isValidResult(result) {
  // Title should be reasonably long
  if (!result.title || result.title.length < 2) return false;
  
  // Title shouldn't be just numbers
  if (/^\d+$/.test(result.title)) return false;
  
  // If author exists, it should look like a name
  if (result.author) {
    const words = result.author.split(/\s+/);
    // Author should have at least one word, at most 4
    if (words.length < 1 || words.length > 4) return false;
    // Each word should be capitalized reasonably
    if (!words.every(w => /^[A-Z][a-z]*\.?$/.test(w))) return false;
  }
  
  return true;
}
