/**
 * Google Books API — free, no API key required for basic volume searches.
 * Provides good cover images and metadata.
 *
 * Docs: https://developers.google.com/books/docs/v1/using
 */

const BASE = 'https://www.googleapis.com/books/v1/volumes';

// ── ISBN conversion helpers ──

/**
 * Convert ISBN-13 (978...) to ISBN-10.
 * Returns null if the ISBN-13 doesn't start with 978.
 */
function isbn13to10(isbn13) {
  const clean = isbn13.replace(/[-\s]/g, '');
  if (clean.length !== 13 || !clean.startsWith('978')) return null;
  const core = clean.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(core[i], 10) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

/**
 * Convert ISBN-10 to ISBN-13 (978 prefix).
 */
function isbn10to13(isbn10) {
  const clean = isbn10.replace(/[-\s]/g, '');
  if (clean.length !== 10) return null;
  const core = '978' + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(core[i], 10) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return core + String(check);
}

// ── Title normalization ──

/**
 * Normalize a title for better search results:
 * - Strip subtitle after : or —
 * - Remove edition markers like [2nd Ed.], (Edición revisada)
 * - Remove format tags like (Kindle), (ebook), (PDF)
 * - Remove embedded ISBNs, years, library tags, author names
 */
function normalizeTitle(title) {
  if (!title) return '';
  let t = title;

  // Remove ISBNs (13 or 10 digit) anywhere in the title
  t = t.replace(/[\[\(]?\b97[89][-\s]?\d[-\s]?\d{2}[-\s]?\d{5}[-\s]?\d[-\s]?[\dX]\b[\]\)]?/gi, '');
  t = t.replace(/[\[\(]?\b\d{9}[\dX]\b[\]\)]?/gi, '');

  // Remove years in brackets/parens: (2003), [1999]
  t = t.replace(/[\[\(]\s*(?:18|19|20)\d{2}\s*[\]\)]/g, '');

  // Remove library/tool/source tags: [calibre 3.0], (z-lib.org), [EPUB], (Kindle), [PDF], etc.
  t = t.replace(/\s*[\[\(](?:calibre|z-?lib|epub|mobi|pdf|kindle|ebook|paperback|hardcover|tapa (?:dura|blanda)|v?\d+\.\d+|www\.[^\]]+)[^\]\)]*[\]\)]/gi, '');

  // Remove language/edition tags: (Spanish Edition), [Lingua spagnola], (Edición en español)
  t = t.replace(/[\(\[]\s*(Spanish|English|French|Portuguese|German|Italian)\s*(Edition|Ed\.?)?\s*[\)\]]/gi, '');
  t = t.replace(/[\(\[]\s*(Edici[oó]n\s*(en\s*)?(espa[nñ]ol|ingl[eé]s|franc[eé]s|portugu[eé]s|alem[aá]n|italiano))\s*[\)\]]/gi, '');
  t = t.replace(/[\(\[]\s*Lingua\s+\w+\s*[\)\]]/gi, '');

  // Strip subtitle after : or — or –
  t = t.split(/\s*[:\u2014\u2013]\s*/)[0];

  // Remove bracketed/parenthesized edition markers
  t = t.replace(/\s*[\[(][^\])]*(?:ed\.?|edition|edici[oó]n|revisad)[\])]/gi, '');

  // Remove trailing parenthesized format info
  t = t.replace(/\s*\((?:kindle|ebook|pdf|epub|paperback|hardcover|tapa dura|tapa blanda)\)\s*$/gi, '');

  // Remove empty brackets/parens and clean up
  t = t.replace(/[\[\(]\s*[\]\)]/g, '');
  t = t.replace(/\s*[-–—]\s*$/, '');
  t = t.replace(/^\s*[-–—]\s*/, '');
  t = t.replace(/\s{2,}/g, ' ');
  return t.trim();
}

/**
 * Pick the best item from a Google Books result set.
 * Prefers items that have cover images (more imageLinks variants = higher confidence).
 * Falls back to first item if none have covers (still useful for metadata).
 */
function pickBestItem(items) {
  if (!items?.length) return null;
  let best = null;
  let bestScore = -1;
  for (const item of items) {
    const links = item.volumeInfo?.imageLinks;
    const score = links ? Object.keys(links).length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return normalizeVolume(best || items[0]);
}

/**
 * Search Google Books by title and author.
 * Uses progressive fallback: structured → plain → no lang restriction.
 * Prefers results with actual cover images over those without.
 * @param {string} title
 * @param {string} author
 * @returns {Promise<object|null>} Normalized metadata or null
 */
export async function searchByTitleAuthor(title, author, lang = '') {
  if (!title) return null;

  const cleanTitle = normalizeTitle(title);
  if (!cleanTitle) return null;
  const langParam = lang ? `&langRestrict=${lang}` : '';

  // Try structured query first (more precise)
  let q = `intitle:${cleanTitle}`;
  if (author) q += `+inauthor:${author}`;

  try {
    let res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=5${langParam}`);
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length) return pickBestItem(data.items);
    }

    // Fallback 1: plain-text query (much more forgiving for non-exact titles/authors)
    const plainQ = author ? `${cleanTitle} ${author}` : cleanTitle;
    res = await fetch(`${BASE}?q=${encodeURIComponent(plainQ)}&maxResults=5${langParam}`);
    if (res.ok) {
      const data2 = await res.json();
      if (data2.items?.length) return pickBestItem(data2.items);
    }

    // Fallback 2: retry WITHOUT lang restriction (book may be cataloged in a different language)
    if (langParam) {
      res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=5`);
      if (res.ok) {
        const data3 = await res.json();
        if (data3.items?.length) return pickBestItem(data3.items);
      }

      res = await fetch(`${BASE}?q=${encodeURIComponent(plainQ)}&maxResults=5`);
      if (res.ok) {
        const data4 = await res.json();
        if (data4.items?.length) return pickBestItem(data4.items);
      }
    }

    // Fallback 3: title-only search (author might be wrong or too specific)
    if (author && cleanTitle.length >= 4) {
      res = await fetch(`${BASE}?q=intitle:${encodeURIComponent(cleanTitle)}&maxResults=5`);
      if (res.ok) {
        const data5 = await res.json();
        if (data5.items?.length) return pickBestItem(data5.items);
      }
    }

    return null;
  } catch (err) {
    console.warn('Google Books search failed:', err);
    return null;
  }
}

/**
 * Search Google Books by ISBN.
 * @param {string} isbn
 * @returns {Promise<object|null>} Normalized metadata or null
 */
export async function searchByISBN(isbn) {
  const clean = isbn.replace(/[-\s]/g, '');
  if (!clean) return null;

  try {
    const res = await fetch(`${BASE}?q=isbn:${clean}&maxResults=3`);
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length) return pickBestItem(data.items);
    }

    // Try converted ISBN (13→10 or 10→13) if original didn't find anything
    const converted = clean.length === 13 ? isbn13to10(clean) : isbn10to13(clean);
    if (converted) {
      const res2 = await fetch(`${BASE}?q=isbn:${converted}&maxResults=3`);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.items?.length) return pickBestItem(data2.items);
      }
    }

    return null;
  } catch (err) {
    console.warn('Google Books ISBN search failed:', err);
    return null;
  }
}

/**
 * Normalize a Google Books volume to our app's metadata format.
 */
function normalizeVolume(item) {
  const info = item.volumeInfo || {};

  // Get the best available cover (prefer larger)
  let coverUrl = '';
  if (info.imageLinks) {
    coverUrl = info.imageLinks.extraLarge
      || info.imageLinks.large
      || info.imageLinks.medium
      || info.imageLinks.thumbnail
      || info.imageLinks.smallThumbnail
      || '';
    coverUrl = upgradeGoogleCoverUrl(coverUrl);
  }

  // Extract ISBN-13 or ISBN-10
  let isbn = '';
  if (info.industryIdentifiers) {
    const isbn13 = info.industryIdentifiers.find((id) => id.type === 'ISBN_13');
    const isbn10 = info.industryIdentifiers.find((id) => id.type === 'ISBN_10');
    isbn = isbn13?.identifier || isbn10?.identifier || '';
  }

  // Map language to our codes
  const langMap = { es: 'es', en: 'en', pt: 'pt', fr: 'fr', de: 'de', it: 'it' };
  const language = langMap[info.language] || '';

  return {
    title: info.title || '',
    author: info.authors?.join(', ') || '',
    description: cleanDescription(info.description || ''),
    coverUrl,
    genre: info.categories?.slice(0, 2).join(', ') || '',
    publishDate: info.publishedDate || '',
    isbn,
    language,
    pageCount: info.pageCount || 0,
    source: 'google',
  };
}

/**
 * Search Google Books and return multiple cover URLs.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<{url: string, source: string, label: string}>>}
 */
export async function searchCovers(title, author, isbn, lang = '') {
  const covers = [];
  const seen = new Set();
  const cleanTitle = normalizeTitle(title);
  const langParam = lang ? `&langRestrict=${lang}` : '';

  const addCover = (url, label) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    covers.push({ url, source: 'google', label });
  };

  try {
    // Search by ISBN first (most precise), try both formats — no lang filter (ISBN is unique)
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const isbns = [clean];
      const converted = clean.length === 13 ? isbn13to10(clean) : isbn10to13(clean);
      if (converted) isbns.push(converted);

      for (const isbnVal of isbns) {
        const res = await fetch(`${BASE}?q=isbn:${isbnVal}&maxResults=3`);
        if (res.ok) {
          const data = await res.json();
          for (const item of (data.items || [])) {
            const cover = extractCover(item);
            if (cover) addCover(cover, item.volumeInfo?.title || 'ISBN match');
          }
        }
      }
    }

    // Search by title+author — try structured query first, then fallbacks
    if (cleanTitle) {
      let q = `intitle:${cleanTitle}`;
      if (author) q += `+inauthor:${author}`;
      let res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=8${langParam}`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          const cover = extractCover(item);
          if (cover) addCover(cover, item.volumeInfo?.title || '');
        }
      }

      // Fallback 1: plain-text query (finds books intitle: misses)
      if (covers.length === 0) {
        const plainQ = author ? `${cleanTitle} ${author}` : cleanTitle;
        res = await fetch(`${BASE}?q=${encodeURIComponent(plainQ)}&maxResults=8${langParam}`);
        if (res.ok) {
          const data = await res.json();
          for (const item of (data.items || [])) {
            const cover = extractCover(item);
            if (cover) addCover(cover, item.volumeInfo?.title || '');
          }
        }
      }

      // Fallback 2: retry without lang restriction if still no covers
      if (covers.length === 0 && langParam) {
        res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=8`);
        if (res.ok) {
          const data = await res.json();
          for (const item of (data.items || [])) {
            const cover = extractCover(item);
            if (cover) addCover(cover, item.volumeInfo?.title || '');
          }
        }
      }
    }
  } catch (err) {
    console.warn('Google Books cover search failed:', err);
  }

  return covers;
}

/**
 * Extract the best cover URL from a Google Books volume item.
 */
function extractCover(item) {
  const links = item.volumeInfo?.imageLinks;
  if (!links) return '';
  const url = links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail || '';
  return upgradeGoogleCoverUrl(url);
}

/**
 * Upgrade Google Books cover URL: https, remove curl, request full resolution (zoom=0).
 */
function upgradeGoogleCoverUrl(url) {
  if (!url) return '';
  let u = url.replace(/^http:/, 'https:');
  u = u.replace(/&edge=curl/g, '');
  // zoom=1 returns ~128px thumbnail; zoom=0 returns full-resolution cover
  u = u.replace(/zoom=\d/, 'zoom=0');
  return u;
}

/**
 * Search Google Books and return MULTIPLE normalized candidates.
 * Used by batch update for Plex-style candidate selection.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<object>>} Array of normalized metadata objects
 */
export async function searchMultiple(title, author, isbn, lang = '') {
  const candidates = [];
  const seen = new Set();
  const cleanTitle = normalizeTitle(title);
  const langParam = lang ? `&langRestrict=${lang}` : '';

  const addCandidate = (item, searchType) => {
    const norm = normalizeVolume(item);
    const key = normalizeForDedup(`${norm.title}|${norm.author}`);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ ...norm, searchType });
  };

  try {
    // 1. ISBN search (highest confidence), try both formats — no lang filter
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const isbns = [clean];
      const converted = clean.length === 13 ? isbn13to10(clean) : isbn10to13(clean);
      if (converted) isbns.push(converted);

      for (const isbnVal of isbns) {
        const res = await fetch(`${BASE}?q=isbn:${isbnVal}&maxResults=3`);
        if (res.ok) {
          const data = await res.json();
          for (const item of (data.items || [])) addCandidate(item, 'isbn');
        }
      }
    }

    // 2. Structured title+author search
    if (cleanTitle) {
      let q = `intitle:${cleanTitle}`;
      if (author) q += `+inauthor:${author}`;
      const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=5${langParam}`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) addCandidate(item, 'title');
      }
    }

    // 3. Fallback plain-text search if few results
    if (candidates.length < 3 && cleanTitle) {
      const plainQ = author ? `${cleanTitle} ${author}` : cleanTitle;
      const res = await fetch(`${BASE}?q=${encodeURIComponent(plainQ)}&maxResults=5${langParam}`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) addCandidate(item, 'title');
      }
    }

    // 4. Retry without lang restriction if still few results
    if (candidates.length < 3 && langParam && cleanTitle) {
      let q = `intitle:${cleanTitle}`;
      if (author) q += `+inauthor:${author}`;
      const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=5`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) addCandidate(item, 'title');
      }
    }
  } catch (err) {
    console.warn('Google Books searchMultiple failed:', err);
  }

  return candidates.slice(0, 8);
}

/**
 * Normalize a string for dedup: lowercase, strip punctuation, collapse spaces.
 */
function normalizeForDedup(str) {
  return str.toLowerCase().replace(/[^\w\s|]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Strip HTML from Google Books descriptions
 */
function cleanDescription(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
