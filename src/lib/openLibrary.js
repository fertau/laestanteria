/**
 * Fetch book metadata from Open Library by ISBN.
 */
export async function fetchByISBN(isbn) {
  const cleanISBN = isbn.replace(/[-\s]/g, '');
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
    coverUrl: book.cover?.medium || book.cover?.large || '',
    genre: book.subjects?.slice(0, 2).map((s) => s.name).join(', ') || '',
    publishDate: book.publish_date || '',
  };
}
