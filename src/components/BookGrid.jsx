import BookCard from './BookCard';

export default function BookGrid({ books, onBookClick }) {
  if (books.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
      gap: 16,
    }}>
      {books.map((book, i) => (
        <BookCard
          key={book.id}
          book={book}
          onClick={onBookClick}
          animationDelay={i * 40}
        />
      ))}
    </div>
  );
}
