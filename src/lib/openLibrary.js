/**
 * Open Library API — free, no API key required.
 * Good for ISBN lookups and has extensive coverage of older/international books.
 */

/**
 * Fetch book metadata from Open Library by ISBN.
 * @param {string} isbn
 * @returns {Promise<object|null>}
 */
export async function fetchByISBN(isbn) {
  const cleanISBN = isbn.replace(/[-\s]/g, '');
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`
    );
    const data = await res.json();
    const book = data[`ISBN:${cleanISBN}`];

    if (!book) return null;

    // Prefer API cover, fall back to direct Covers API URL
    const coverUrl = book.cover?.large || book.cover?.medium
      || `https://covers.openlibrary.org/b/isbn/${cleanISBN}-L.jpg`;

    return {
      title: book.title || '',
      author: book.authors?.map((a) => a.name).join(', ') || '',
      description: book.notes || book.excerpts?.[0]?.text || '',
      coverUrl,
      genre: book.subjects?.slice(0, 2).map((s) => s.name).join(', ') || '',
      publishDate: book.publish_date || '',
      isbn: cleanISBN,
      source: 'openlibrary',
    };
  } catch (err) {
    console.warn('Open Library ISBN search failed:', err);
    return null;
  }
}

/**
 * Search Open Library by title and author.
 * Uses the Search API: https://openlibrary.org/dev/docs/api/search
 * @param {string} title
 * @param {string} author
 * @returns {Promise<object|null>}
 */
export async function searchByTitleAuthor(title, author) {
  if (!title) return null;

  const params = new URLSearchParams({ limit: '3' });
  params.set('title', title);
  if (author) params.set('author', author);

  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`);
    const data = await res.json();

    if (!data.docs?.length) return null;

    const doc = data.docs[0];

    // Build cover URL from cover_i (cover ID)
    let coverUrl = '';
    if (doc.cover_i) {
      coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }

    // Get ISBN
    const isbn = doc.isbn?.find((i) => i.length === 13) || doc.isbn?.[0] || '';

    return {
      title: doc.title || '',
      author: doc.author_name?.join(', ') || '',
      description: doc.first_sentence?.join(' ') || '',
      coverUrl,
      genre: doc.subject?.slice(0, 2).join(', ') || '',
      publishDate: doc.first_publish_year?.toString() || '',
      isbn,
      source: 'openlibrary',
    };
  } catch (err) {
    console.warn('Open Library search failed:', err);
    return null;
  }
}

/**
 * Normalize an Open Library search doc to our standard metadata format.
 * Shared between searchByTitleAuthor, searchMultiple, etc.
 */
function normalizeSearchDoc(doc) {
  let coverUrl = '';
  if (doc.cover_i) {
    coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  }
  const isbn = doc.isbn?.find((i) => i.length === 13) || doc.isbn?.[0] || '';
  return {
    title: doc.title || '',
    author: doc.author_name?.join(', ') || '',
    description: doc.first_sentence?.join(' ') || '',
    coverUrl,
    genre: doc.subject?.slice(0, 2).join(', ') || '',
    publishDate: doc.first_publish_year?.toString() || '',
    isbn,
    source: 'openlibrary',
  };
}

/**
 * Search Open Library and return MULTIPLE normalized candidates.
 * Used by batch update for Plex-style candidate selection.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<object>>}
 */
export async function searchMultiple(title, author, isbn) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (result, searchType) => {
    const key = `${result.title}|${result.author}`.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ ...result, searchType });
  };

  try {
    // 1. ISBN lookup (direct API)
    if (isbn) {
      const result = await fetchByISBN(isbn);
      if (result) addCandidate(result, 'isbn');
    }

    // 2. ISBN search (finds variant editions)
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const res = await fetch(
        `https://openlibrary.org/search.json?isbn=${clean}&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        for (const doc of (data.docs || [])) {
          addCandidate(normalizeSearchDoc(doc), 'isbn');
        }
      }
    }

    // 3. Title+author search
    if (title) {
      const params = new URLSearchParams({ limit: '8' });
      params.set('title', title);
      if (author) params.set('author', author);
      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      if (res.ok) {
        const data = await res.json();
        for (const doc of (data.docs || [])) {
          addCandidate(normalizeSearchDoc(doc), 'title');
        }
      }
    }
  } catch (err) {
    console.warn('Open Library searchMultiple failed:', err);
  }

  return candidates.slice(0, 8);
}

/**
 * Search Open Library and return multiple cover URLs.
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
    covers.push({ url, source: 'openlibrary', label });
  };

  try {
    // Direct Covers API by ISBN — no search needed, very reliable
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const directUrl = `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg`;
      try {
        const head = await fetch(directUrl, { method: 'HEAD' });
        // OL returns 200 with a 1x1 placeholder when no cover exists, check content-length
        const cl = parseInt(head.headers.get('content-length') || '0', 10);
        if (head.ok && cl > 1000) {
          addCover(directUrl, 'Open Library ISBN');
        }
      } catch { /* ignore HEAD failure */ }
    }

    // Search API by ISBN
    if (isbn) {
      const clean = isbn.replace(/[-\s]/g, '');
      const res = await fetch(
        `https://openlibrary.org/search.json?isbn=${clean}&limit=5&fields=title,cover_i,author_name`
      );
      if (res.ok) {
        const data = await res.json();
        for (const doc of (data.docs || [])) {
          if (doc.cover_i) {
            addCover(
              `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
              doc.title || 'ISBN match'
            );
          }
        }
      }
    }

    // Search by title+author
    if (title) {
      const params = new URLSearchParams({ limit: '10', fields: 'title,cover_i,author_name' });
      params.set('title', title);
      if (author) params.set('author', author);
      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      if (res.ok) {
        const data = await res.json();
        for (const doc of (data.docs || [])) {
          if (doc.cover_i) {
            addCover(
              `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
              doc.title || ''
            );
          }
        }
      }

      // Fallback: if title+author found nothing, try title only
      if (covers.length === 0 && author) {
        const params2 = new URLSearchParams({ limit: '10', fields: 'title,cover_i,author_name' });
        params2.set('title', title);
        const res2 = await fetch(`https://openlibrary.org/search.json?${params2}`);
        if (res2.ok) {
          const data2 = await res2.json();
          for (const doc of (data2.docs || [])) {
            if (doc.cover_i) {
              addCover(
                `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
                doc.title || ''
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Open Library cover search failed:', err);
  }

  return covers;
}
