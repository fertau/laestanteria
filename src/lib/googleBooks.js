/**
 * Google Books API — free, no API key required for basic volume searches.
 * Provides good cover images and metadata.
 *
 * Docs: https://developers.google.com/books/docs/v1/using
 */

const BASE = 'https://www.googleapis.com/books/v1/volumes';

/**
 * Search Google Books by title and author.
 * @param {string} title
 * @param {string} author
 * @returns {Promise<object|null>} Normalized metadata or null
 */
export async function searchByTitleAuthor(title, author) {
  if (!title) return null;

  // Try structured query first (more precise)
  let q = `intitle:${title}`;
  if (author) q += `+inauthor:${author}`;

  try {
    let res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=3`);
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length) return normalizeVolume(data.items[0]);
    }

    // Fallback: plain-text query (much more forgiving for non-exact titles/authors)
    const plainQ = author ? `${title} ${author}` : title;
    res = await fetch(`${BASE}?q=${encodeURIComponent(plainQ)}&maxResults=3`);
    if (!res.ok) return null;
    const data2 = await res.json();
    if (!data2.items?.length) return null;
    return normalizeVolume(data2.items[0]);
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
    const res = await fetch(`${BASE}?q=isbn:${clean}&maxResults=1`);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.items?.length) return null;
    return normalizeVolume(data.items[0]);
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
export async function searchCovers(title, author, isbn) {
  const covers = [];
  const seen = new Set();

  const addCover = (url, label) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    covers.push({ url, source: 'google', label });
  };

  try {
    // Search by ISBN first (most precise)
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const res = await fetch(`${BASE}?q=isbn:${clean}&maxResults=3`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          const cover = extractCover(item);
          if (cover) addCover(cover, item.volumeInfo?.title || 'ISBN match');
        }
      }
    }

    // Search by title+author — try structured query first, then plain-text fallback
    if (title) {
      let q = `intitle:${title}`;
      if (author) q += `+inauthor:${author}`;
      let res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=8`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          const cover = extractCover(item);
          if (cover) addCover(cover, item.volumeInfo?.title || '');
        }
      }

      // Fallback: plain-text query (finds books intitle: misses)
      if (covers.length === 0) {
        const plainQ = author ? `${title} ${author}` : title;
        res = await fetch(`${BASE}?q=${encodeURIComponent(plainQ)}&maxResults=8`);
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
 * Strip HTML from Google Books descriptions
 */
function cleanDescription(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
