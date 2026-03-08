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

    return {
      title: book.title || '',
      author: book.authors?.map((a) => a.name).join(', ') || '',
      description: book.notes || book.excerpts?.[0]?.text || '',
      coverUrl: book.cover?.large || book.cover?.medium || '',
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
