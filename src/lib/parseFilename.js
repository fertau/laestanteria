/**
 * Smart filename parser for EPUB files.
 * Extracts ISBN, year, author, and title from common naming conventions.
 *
 * Supported patterns:
 *   "Author - Title (Year) [ISBN].epub"          → Calibre style
 *   "978-0451524935 - George Orwell - 1984.epub"  → ISBN first
 *   "Author - Title [2020].epub"                  → Year in brackets
 *   "Title (Author, 2019).epub"                   → Parenthesized author+year
 *   "El Principito.epub"                          → Title only
 *   "author_name - book_title.epub"               → Underscores
 *
 * @param {string} filename - The EPUB filename (with or without .epub extension)
 * @returns {{ title: string, author: string, isbn: string, year: string }}
 */
export function parseFilename(filename) {
  let name = filename.replace(/\.epub$/i, '').trim();

  let isbn = '';
  let year = '';
  let author = '';
  let title = '';

  // --- 1. Extract ISBN ---
  // ISBN-13: starts with 978 or 979, 13 digits (with optional hyphens/spaces)
  const isbn13Regex = /[\[\(]?(97[89][-\s]?\d[-\s]?\d{2}[-\s]?\d{5}[-\s]?\d[-\s]?[\dX])[\]\)]?/i;
  // ISBN-10: 9 digits + digit or X (with optional hyphens/spaces)
  const isbn10Regex = /[\[\(]?(\d[-\s]?\d{2}[-\s]?\d{5}[-\s]?\d[-\s]?[\dX])[\]\)]?/i;

  let isbnMatch = name.match(isbn13Regex);
  if (isbnMatch) {
    isbn = isbnMatch[1].replace(/[-\s]/g, '');
    name = name.replace(isbnMatch[0], '').trim();
  } else {
    // Only try ISBN-10 if it looks like a standalone number, not part of a year
    // ISBN-10 must not be preceded/followed by alphabetic chars
    const isbn10Match = name.match(/(?:^|[\s\-_\[\(])(\d{9}[\dX])(?:[\s\-_\]\)]|$)/i);
    if (isbn10Match) {
      isbn = isbn10Match[1].replace(/[-\s]/g, '');
      name = name.replace(isbn10Match[0], ' ').trim();
    }
  }

  // --- 2. Extract year ---
  // Year in parentheses (1800-2099) or brackets
  const yearRegex = /[\(\[]((?:18|19|20)\d{2})[\)\]]/;
  const yearMatch = name.match(yearRegex);
  if (yearMatch) {
    year = yearMatch[1];
    name = name.replace(yearMatch[0], '').trim();
  }

  // --- 3. Clean up ---
  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');
  // Remove empty brackets/parens left after extraction
  name = name.replace(/[\[\(]\s*[\]\)]/g, '');
  // Collapse multiple spaces, dashes, or separators
  name = name.replace(/\s*-\s*-\s*/g, ' - ');
  name = name.replace(/\s{2,}/g, ' ');
  // Remove leading/trailing dashes and spaces
  name = name.replace(/^\s*[-–—]\s*/, '').replace(/\s*[-–—]\s*$/, '').trim();

  // --- 4. Split author + title ---
  // Try splitting by " - " (most common: "Author - Title")
  const parts = name.split(/\s+[-–—]\s+/);

  if (parts.length >= 3) {
    // Could be "ISBN - Author - Title" (ISBN already extracted)
    // or "Author - Title - Subtitle"
    // Heuristic: if first part looks like author (shorter, capitalized), use it
    author = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  } else if (parts.length === 2) {
    author = parts[0].trim();
    title = parts[1].trim();
  } else {
    // No separator — entire thing is the title
    title = name.trim();
  }

  // --- 5. Final cleanup ---
  // Remove any remaining brackets content that looks like metadata tags
  // e.g., "[calibre 3.0]", "[EPUB]", "(z-lib.org)", "(Spanish Edition)"
  const metaTags = /\s*[\[\(](?:calibre|z-?lib|epub|mobi|pdf|kindle|ebook|paperback|hardcover|tapa (?:dura|blanda)|v?\d+\.\d+|www\.[^\]]+)[^\]\)]*[\]\)]/gi;
  title = title.replace(metaTags, '').trim();
  author = author.replace(metaTags, '').trim();

  // Remove language/edition tags from title and author
  const editionTags = /\s*[\[\(]\s*(?:Spanish|English|French|Portuguese|German|Italian)\s*(?:Edition|Ed\.?)?\s*[\]\)]/gi;
  title = title.replace(editionTags, '').trim();
  author = author.replace(editionTags, '').trim();

  const edicionTags = /\s*[\[\(]\s*(?:Edici[oó]n\s*(?:en\s*)?(?:espa[nñ]ol|ingl[eé]s|franc[eé]s|portugu[eé]s|alem[aá]n|italiano))\s*[\]\)]/gi;
  title = title.replace(edicionTags, '').trim();
  author = author.replace(edicionTags, '').trim();

  // Remove "Lingua X" tags
  title = title.replace(/\s*[\[\(]\s*Lingua\s+\w+\s*[\]\)]/gi, '').trim();
  author = author.replace(/\s*[\[\(]\s*Lingua\s+\w+\s*[\]\)]/gi, '').trim();

  // Clean up empty brackets and trailing separators
  title = title.replace(/[\[\(]\s*[\]\)]/g, '').replace(/\s*[-–—]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  author = author.replace(/[\[\(]\s*[\]\)]/g, '').replace(/\s*[-–—]\s*$/, '').replace(/\s{2,}/g, ' ').trim();

  return { title, author, isbn, year };
}
