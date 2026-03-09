import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useActivity } from '../hooks/useActivity';
import { useFollows } from '../hooks/useFollows';
import BookCard from '../components/BookCard';
import BookGrid from '../components/BookGrid';
import BookModal from '../components/BookModal';
import Avatar from '../components/Avatar';

export default function Home() {
  const { profile } = useAuth();
  const { books, loading: booksLoading, hasFollows } = useBooks();
  const { activities, loading: actLoading } = useActivity(15);
  const { following } = useFollows();

  const [selectedBook, setSelectedBook] = useState(null);

  // Recent books (last 8)
  const recentBooks = useMemo(() => {
    return [...books]
      .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0))
      .slice(0, 8);
  }, [books]);

  // Top rated books (min 1 rating, sorted by avg)
  const topRated = useMemo(() => {
    return [...books]
      .filter((b) => b.ratingCount > 0)
      .sort((a, b) => {
        const avgA = a.ratingSum / a.ratingCount;
        const avgB = b.ratingSum / b.ratingCount;
        return avgB - avgA;
      })
      .slice(0, 8);
  }, [books]);

  // Catalog preview (6 random-ish books sorted by title)
  const catalogPreview = useMemo(() => {
    return [...books]
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .slice(0, 6);
  }, [books]);

  // Stats
  const totalBooks = books.length;
  const totalReaders = useMemo(() => {
    const ids = new Set(books.map((b) => b.uploadedBy?.uid).filter(Boolean));
    return Math.max(ids.size, 1);
  }, [books]);

  const isNewUser = !hasFollows && books.length === 0;
  const firstName = profile?.displayName?.split(' ')[0] || '';

  if (booksLoading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: 0 }}>

      {/* ===== HERO SECTION ===== */}
      <section style={{
        background: 'var(--gradient-hero)',
        padding: '28px 20px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            marginBottom: 4,
          }}>
            Hola, {firstName}
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 24,
            color: 'var(--text)',
            margin: '0 0 8px',
            lineHeight: 1.2,
          }}>
            Tu cueva compartida
          </h1>
          <p style={{
            fontSize: 13,
            fontWeight: 300,
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)',
          }}>
            {totalBooks} {totalBooks === 1 ? 'libro' : 'libros'} · {totalReaders} {totalReaders === 1 ? 'lector' : 'lectores'}
          </p>
        </div>
      </section>

      {/* Content wrapper */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 40px' }}>

        {/* ===== ONBOARDING CTA ===== */}
        {isNewUser && (
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            textAlign: 'center',
            marginTop: 24,
            marginBottom: 8,
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 18, marginBottom: 8, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Bienvenido/a a La Cueva
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
              Empezá siguiendo a alguien del grupo para ver sus libros.
            </p>
            <Link to="/people" className="btn btn-primary">
              Ver personas
            </Link>
          </div>
        )}

        {/* ===== RECIÉN LLEGADOS — horizontal scroll ===== */}
        {recentBooks.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div className="section-title">
              <span>Recién llegados</span>
              <Link to="/catalog" className="section-link">Ver todo →</Link>
            </div>
            <div className="horizontal-scroll" style={{ paddingBottom: 4 }}>
              {recentBooks.map((book, i) => (
                <div key={book.id} style={{ flex: '0 0 140px', maxWidth: 140 }}>
                  <BookCard
                    book={book}
                    onClick={setSelectedBook}
                    animationDelay={i * 50}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== MEJOR VALORADOS — horizontal scroll ===== */}
        {topRated.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div className="section-title">
              <span>Mejor valorados</span>
            </div>
            <div className="horizontal-scroll" style={{ paddingBottom: 4 }}>
              {topRated.map((book, i) => (
                <div key={book.id} style={{ flex: '0 0 140px', maxWidth: 140 }}>
                  <BookCard
                    book={book}
                    onClick={setSelectedBook}
                    animationDelay={i * 50}
                    style={{ boxShadow: 'var(--shadow-glow)' }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== CATÁLOGO GRID PREVIEW ===== */}
        {catalogPreview.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div className="section-title">
              <span>Catálogo</span>
              <Link to="/catalog" className="section-link">Ver todo →</Link>
            </div>
            <BookGrid books={catalogPreview} onBookClick={setSelectedBook} />
          </section>
        )}

        {/* ===== DIVIDER ===== */}
        <div className="divider" />

        {/* ===== ACTIVIDAD RECIENTE ===== */}
        <section>
          <div className="section-title">
            <span>Actividad</span>
          </div>
          {actLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : activities.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 14 }}>
              No hay actividad reciente. Seguí a alguien para ver su actividad.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activities.map((a) => (
                <ActivityItem key={a.id} activity={a} />
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}

function ActivityItem({ activity }) {
  const timeAgo = activity.createdAt?.seconds
    ? formatTimeAgo(activity.createdAt.seconds * 1000)
    : '';

  let icon = '📖';
  let text = '';
  if (activity.type === 'book_added') {
    icon = '📚';
    text = `subió "${activity.bookTitle}" de ${activity.bookAuthor}`;
  } else if (activity.type === 'reading_status') {
    icon = '📖';
    text = `${activity.statusLabel} "${activity.bookTitle}"`;
  } else {
    text = activity.type;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      transition: 'background var(--transition)',
    }}>
      <Avatar src={null} name={activity.actorName} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{activity.actorName}</span>
        {' '}
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
        {timeAgo}
      </span>
    </div>
  );
}

function formatTimeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem`;
}
