/**
 * Open Library API — free, no API key required.
 * Good for ISBN lookups and has extensive coverage of older/international books.
 */

/**
 * Map 2-letter language codes to Open Library's 3-letter ISO 639-2 codes.
 */
const OL_LANG_MAP = {
  es: 'spa', en: 'eng', pt: 'por', fr: 'fre', de: 'ger', it: 'ita',
};

/**
 * Normalize a title for better search results:
 * - Remove ISBNs, years, library tags embedded in the title
 * - Strip subtitle after : or — or –
 * - Remove edition markers and format tags
 */
function normalizeTitle(title) {
  if (!title) return '';
  let t = title;

  // Remove ISBNs (13 or 10 digit)
  t = t.replace(/[\[\(]?\b97[89][-\s]?\d[-\s]?\d{2}[-\s]?\d{5}[-\s]?\d[-\s]?[\dX]\b[\]\)]?/gi, '');
  t = t.replace(/[\[\(]?\b\d{9}[\dX]\b[\]\)]?/gi, '');

  // Remove years in brackets/parens
  t = t.replace(/[\[\(]\s*(?:18|19|20)\d{2}\s*[\]\)]/g, '');

  // Remove library/tool/source tags
  t = t.replace(/\s*[\[\(](?:calibre|z-?lib|epub|mobi|pdf|kindle|ebook|paperback|hardcover|tapa (?:dura|blanda)|v?\d+\.\d+|www\.[^\]]+)[^\]\)]*[\]\)]/gi, '');

  // Remove language/edition tags
  t = t.replace(/[\(\[]\s*(Spanish|English|French|Portuguese|German|Italian)\s*(Edition|Ed\.?)?\s*[\)\]]/gi, '');
  t = t.replace(/[\(\[]\s*(Edici[oó]n\s*(en\s*)?(espa[nñ]ol|ingl[eé]s|franc[eé]s|portugu[eé]s|alem[aá]n|italiano))\s*[\)\]]/gi, '');
  t = t.replace(/[\(\[]\s*Lingua\s+\w+\s*[\)\]]/gi, '');

  // Strip subtitle after : or — or –
  t = t.split(/\s*[:\u2014\u2013]\s*/)[0];

  // Remove edition markers
  t = t.replace(/\s*[\[(][^\])]*(?:ed\.?|edition|edici[oó]n|revisad)[\])]/gi, '');
  t = t.replace(/\s*\((?:kindle|ebook|pdf|epub|paperback|hardcover|tapa dura|tapa blanda)\)\s*$/gi, '');

  // Clean up
  t = t.replace(/[\[\(]\s*[\]\)]/g, '');
  t = t.replace(/\s*[-–—]\s*$/, '').replace(/^\s*[-–—]\s*/, '');
  t = t.replace(/\s{2,}/g, ' ');
  return t.trim();
}

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
export async function searchByTitleAuthor(title, author, lang = '') {
  if (!title) return null;

  const cleanTitle = normalizeTitle(title);
  if (!cleanTitle) return null;
  const olLang = OL_LANG_MAP[lang] || '';

  // Try structured title+author search first
  const params = new URLSearchParams({ limit: '5' });
  params.set('title', cleanTitle);
  if (author) params.set('author', author);
  if (olLang) params.set('language', olLang);

  try {
    let res = await fetch(`https://openlibrary.org/search.json?${params}`);
    let data = await res.json();

    // Fallback 1: generic ?q= search (much more forgiving)
    if (!data.docs?.length) {
      const q = author ? `${cleanTitle} ${author}` : cleanTitle;
      const fallbackLang = olLang ? `&language=${olLang}` : '';
      res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5${fallbackLang}`);
      data = await res.json();
    }

    // Fallback 2: retry without language restriction (book may be cataloged differently)
    if (!data.docs?.length && olLang) {
      const paramsNoLang = new URLSearchParams({ limit: '5' });
      paramsNoLang.set('title', cleanTitle);
      if (author) paramsNoLang.set('author', author);
      res = await fetch(`https://openlibrary.org/search.json?${paramsNoLang}`);
      data = await res.json();

      if (!data.docs?.length) {
        const q = author ? `${cleanTitle} ${author}` : cleanTitle;
        res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`);
        data = await res.json();
      }
    }

    // Fallback 3: title-only search (author might be garbled or wrong)
    if (!data.docs?.length && author && cleanTitle.length >= 4) {
      const paramsTitle = new URLSearchParams({ limit: '5' });
      paramsTitle.set('title', cleanTitle);
      res = await fetch(`https://openlibrary.org/search.json?${paramsTitle}`);
      data = await res.json();
    }

    if (!data.docs?.length) return null;

    // Prefer docs with cover images over those without
    const docWithCover = data.docs.find((d) => d.cover_i) || data.docs[0];
    return normalizeSearchDoc(docWithCover);
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
export async function searchMultiple(title, author, isbn, lang = '') {
  const candidates = [];
  const seen = new Set();
  const cleanTitle = normalizeTitle(title);
  const olLang = OL_LANG_MAP[lang] || '';

  const addCandidate = (result, searchType) => {
    const key = normalizeForDedup(`${result.title}|${result.author}`);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ ...result, searchType });
  };

  try {
    // 1. ISBN lookup (direct API — no lang filter)
    if (isbn) {
      const result = await fetchByISBN(isbn);
      if (result) addCandidate(result, 'isbn');
    }

    // 2. ISBN search (finds variant editions — no lang filter)
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

    // 3. Structured title+author search
    if (cleanTitle) {
      const params = new URLSearchParams({ limit: '8' });
      params.set('title', cleanTitle);
      if (author) params.set('author', author);
      if (olLang) params.set('language', olLang);
      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      if (res.ok) {
        const data = await res.json();
        for (const doc of (data.docs || [])) {
          addCandidate(normalizeSearchDoc(doc), 'title');
        }
      }
    }

    // 4. Fallback: generic ?q= search if few results
    if (candidates.length < 3 && cleanTitle) {
      const q = author ? `${cleanTitle} ${author}` : cleanTitle;
      const langSuffix = olLang ? `&language=${olLang}` : '';
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8${langSuffix}`);
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
 * Normalize a string for dedup: lowercase, strip punctuation, collapse spaces.
 */
function normalizeForDedup(str) {
  return str.toLowerCase().replace(/[^\w\s|]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Search Open Library and return multiple cover URLs.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<{url: string, source: string, label: string}>>}
 */
export async function searchCovers(title, author, isbn, lang = '') {
  const covers = [];
  const seen = new Set();
  const cleanTitle = normalizeTitle(title);
  const olLang = OL_LANG_MAP[lang] || '';

  const addCover = (url, label) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    covers.push({ url, source: 'openlibrary', label });
  };

  try {
    // Direct Covers API by ISBN — no search needed, very reliable (no lang filter needed)
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

    // Search API by ISBN (no lang filter — ISBN is unique)
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
    if (cleanTitle) {
      const params = new URLSearchParams({ limit: '10', fields: 'title,cover_i,author_name' });
      params.set('title', cleanTitle);
      if (author) params.set('author', author);
      if (olLang) params.set('language', olLang);
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

      // Fallback 1: generic ?q= search if title+author found nothing
      if (covers.length === 0) {
        const q = author ? `${cleanTitle} ${author}` : cleanTitle;
        const langSuffix = olLang ? `&language=${olLang}` : '';
        const res2 = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=title,cover_i,author_name${langSuffix}`);
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

      // Fallback 2: retry without language restriction
      if (covers.length === 0 && olLang) {
        const paramsNoLang = new URLSearchParams({ limit: '10', fields: 'title,cover_i,author_name' });
        paramsNoLang.set('title', cleanTitle);
        if (author) paramsNoLang.set('author', author);
        const res3 = await fetch(`https://openlibrary.org/search.json?${paramsNoLang}`);
        if (res3.ok) {
          const data3 = await res3.json();
          for (const doc of (data3.docs || [])) {
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
