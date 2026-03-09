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

  let q = `intitle:${title}`;
  if (author) q += `+inauthor:${author}`;

  try {
    const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=3&langRestrict=`);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.items?.length) return null;

    // Pick the best match (first result is usually best)
    return normalizeVolume(data.items[0]);
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
    // Google Books returns http:// URLs — upgrade to https
    coverUrl = coverUrl.replace(/^http:/, 'https:');
    // Remove edge=curl parameter for cleaner images
    coverUrl = coverUrl.replace(/&edge=curl/g, '');
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

    // Search by title+author (broader)
    if (title) {
      let q = `intitle:${title}`;
      if (author) q += `+inauthor:${author}`;
      const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&maxResults=8`);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          const cover = extractCover(item);
          if (cover) addCover(cover, item.volumeInfo?.title || '');
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
  let url = links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail || '';
  url = url.replace(/^http:/, 'https:');
  url = url.replace(/&edge=curl/g, '');
  return url;
}

/**
 * Strip HTML from Google Books descriptions
 */
function cleanDescription(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
