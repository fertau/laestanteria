/**
 * Hardcover API — free GraphQL API (beta, requires API key).
 * Good coverage of contemporary fiction.
 *
 * Endpoint: https://api.hardcover.app/v1/graphql
 * Requires: VITE_HARDCOVER_API_KEY env var (free, get from hardcover.app)
 *
 * ⚠ API is still in beta — schema may change. All functions fail silently
 * and return empty results if the key is missing or the API is unreachable.
 */

const ENDPOINT = 'https://api.hardcover.app/v1/graphql';

function getApiKey() {
  return import.meta.env.VITE_HARDCOVER_API_KEY || '';
}

/**
 * Execute a GraphQL query against Hardcover.
 * Returns null on any failure (no key, network error, etc).
 */
async function gqlQuery(query, variables = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.warn('Hardcover API error:', err);
    return null;
  }
}

/**
 * Normalize a Hardcover book object to our standard format.
 */
function normalizeBook(book) {
  if (!book) return null;

  const author = (book.contributions || [])
    .map((c) => c.author?.name)
    .filter(Boolean)
    .join(', ') || '';

  // Extract genre from cached_tags if available
  let genre = '';
  if (book.cached_tags) {
    try {
      const tags = typeof book.cached_tags === 'string'
        ? JSON.parse(book.cached_tags)
        : book.cached_tags;
      if (Array.isArray(tags) && tags.length > 0) {
        genre = tags.slice(0, 2).map((t) => t.tag || t.name || t).join(', ');
      }
    } catch { /* ignore parse error */ }
  }

  // Cover URL
  let coverUrl = '';
  if (book.image?.url) {
    coverUrl = book.image.url;
  }

  // ISBN from editions if available
  let isbn = '';
  if (book.default_edition?.isbn_13) {
    isbn = book.default_edition.isbn_13;
  } else if (book.default_edition?.isbn_10) {
    isbn = book.default_edition.isbn_10;
  }

  return {
    title: book.title || '',
    author,
    description: book.description || '',
    coverUrl,
    genre,
    publishDate: book.release_date || '',
    isbn,
    language: '', // Hardcover doesn't reliably expose language
    source: 'hardcover',
  };
}

/**
 * Search Hardcover using the search() endpoint.
 * Returns up to `limit` raw book results from the search blob.
 */
async function searchBooks(queryStr, limit = 8) {
  if (!queryStr || !getApiKey()) return [];

  const data = await gqlQuery(`
    query Search($query: String!) {
      search(
        query: $query,
        query_type: "books",
        per_page: ${limit},
        page: 1
      ) {
        results
      }
    }
  `, { query: queryStr });

  if (!data?.search?.results) return [];

  // Results is a JSON blob — parse it
  let results = data.search.results;
  if (typeof results === 'string') {
    try { results = JSON.parse(results); } catch { return []; }
  }

  // Results could be an object with hits or directly an array
  const hits = Array.isArray(results) ? results : (results.hits || results.books || []);
  return hits;
}

/**
 * Search Hardcover by title and author.
 * @param {string} title
 * @param {string} author
 * @returns {Promise<object|null>} Normalized metadata or null
 */
export async function searchByTitleAuthor(title, author) {
  if (!title || !getApiKey()) return null;

  const query = author ? `${title} ${author}` : title;
  const hits = await searchBooks(query, 3);

  if (hits.length === 0) return null;

  // The search result objects may have different shapes — try to normalize
  const first = hits[0];
  const normalized = normalizeSearchHit(first);
  return normalized;
}

/**
 * Search Hardcover and return MULTIPLE normalized candidates.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<object>>}
 */
export async function searchMultiple(title, author, isbn) {
  if (!getApiKey()) return [];

  const candidates = [];
  const seen = new Set();

  const addCandidate = (norm, searchType) => {
    if (!norm || !norm.title) return;
    const key = `${norm.title}|${norm.author}`.toLowerCase().replace(/[^\w|]/g, '').trim();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ ...norm, searchType });
  };

  try {
    // 1. ISBN search (if available)
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const hits = await searchBooks(clean, 3);
      for (const hit of hits) {
        addCandidate(normalizeSearchHit(hit), 'isbn');
      }
    }

    // 2. Title + author search
    if (title) {
      const query = author ? `${title} ${author}` : title;
      const hits = await searchBooks(query, 8);
      for (const hit of hits) {
        addCandidate(normalizeSearchHit(hit), 'title');
      }
    }
  } catch (err) {
    console.warn('Hardcover searchMultiple failed:', err);
  }

  return candidates.slice(0, 8);
}

/**
 * Search Hardcover for cover images.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<{url: string, source: string, label: string}>>}
 */
export async function searchCovers(title, author, isbn) {
  if (!getApiKey()) return [];

  const covers = [];
  const seen = new Set();

  const addCover = (url, label) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    covers.push({ url, source: 'hardcover', label });
  };

  try {
    // ISBN search
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const hits = await searchBooks(clean, 3);
      for (const hit of hits) {
        const norm = normalizeSearchHit(hit);
        if (norm?.coverUrl) addCover(norm.coverUrl, norm.title || 'ISBN match');
      }
    }

    // Title+author search
    if (title) {
      const query = author ? `${title} ${author}` : title;
      const hits = await searchBooks(query, 8);
      for (const hit of hits) {
        const norm = normalizeSearchHit(hit);
        if (norm?.coverUrl) addCover(norm.coverUrl, norm.title || '');
      }
    }
  } catch (err) {
    console.warn('Hardcover cover search failed:', err);
  }

  return covers;
}

/**
 * Normalize a search hit from the search() results blob.
 * The shape can vary — handle multiple formats defensively.
 */
function normalizeSearchHit(hit) {
  if (!hit) return null;

  // The search result may have the full book shape or a simplified one
  const title = hit.title || '';
  const description = hit.description || '';
  const releaseDate = hit.release_date || '';

  // Author from various possible shapes
  let author = '';
  if (hit.contributions) {
    author = hit.contributions.map((c) => c.author?.name).filter(Boolean).join(', ');
  } else if (hit.cached_contributors) {
    try {
      const contribs = typeof hit.cached_contributors === 'string'
        ? JSON.parse(hit.cached_contributors)
        : hit.cached_contributors;
      if (Array.isArray(contribs)) {
        author = contribs.map((c) => c.author?.name || c.name || c).filter(Boolean).join(', ');
      }
    } catch { /* ignore */ }
  } else if (hit.author) {
    author = typeof hit.author === 'string' ? hit.author : (hit.author?.name || '');
  }

  // Cover URL from various shapes
  let coverUrl = '';
  if (hit.image?.url) coverUrl = hit.image.url;
  else if (typeof hit.image === 'string') coverUrl = hit.image;
  else if (hit.cover) coverUrl = typeof hit.cover === 'string' ? hit.cover : (hit.cover?.url || '');

  // Genre from cached_tags
  let genre = '';
  if (hit.cached_tags) {
    try {
      const tags = typeof hit.cached_tags === 'string' ? JSON.parse(hit.cached_tags) : hit.cached_tags;
      if (Array.isArray(tags) && tags.length > 0) {
        genre = tags.slice(0, 2).map((t) => t.tag || t.name || (typeof t === 'string' ? t : '')).filter(Boolean).join(', ');
      }
    } catch { /* ignore */ }
  }

  // ISBN
  let isbn = '';
  if (hit.default_edition?.isbn_13) isbn = hit.default_edition.isbn_13;
  else if (hit.default_edition?.isbn_10) isbn = hit.default_edition.isbn_10;

  if (!title && !author) return null;

  return {
    title,
    author,
    description,
    coverUrl,
    genre,
    publishDate: releaseDate,
    isbn,
    language: '',
    source: 'hardcover',
  };
}
