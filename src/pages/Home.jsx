import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useActivity } from '../hooks/useActivity';
import { useFollows } from '../hooks/useFollows';
import BookGrid from '../components/BookGrid';
import BookModal from '../components/BookModal';
import Avatar from '../components/Avatar';
import { useState } from 'react';

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

  const isNewUser = !hasFollows && books.length === 0;

  if (booksLoading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Hola, {profile?.displayName?.split(' ')[0]}</h1>

      {/* Onboarding CTA for new users */}
      {isNewUser && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Bienvenido/a a La estanteria</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Empeza siguiendo a alguien del grupo para ver sus libros.
          </p>
          <Link to="/people" className="btn btn-primary">
            Ver personas
          </Link>
        </div>
      )}

      {/* Recent books */}
      {recentBooks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
              Ultimas subidas
            </h2>
            <Link to="/catalog" style={{ fontSize: 13 }}>Ver todo</Link>
          </div>
          <BookGrid books={recentBooks} onBookClick={setSelectedBook} />
        </section>
      )}

      {/* Top rated */}
      {topRated.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Mejor valorados</h2>
          <BookGrid books={topRated} onBookClick={setSelectedBook} />
        </section>
      )}

      {/* Activity feed */}
      <section>
        <h2 className="section-title">Actividad reciente</h2>
        {actLoading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : activities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            No hay actividad reciente. Segui a alguien para ver su actividad.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activities.map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </div>
        )}
      </section>

      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}

function ActivityItem({ activity }) {
  const timeAgo = activity.createdAt?.seconds
    ? formatTimeAgo(activity.createdAt.seconds * 1000)
    : '';

  let text = '';
  if (activity.type === 'book_added') {
    text = `subio "${activity.bookTitle}" de ${activity.bookAuthor}`;
  } else if (activity.type === 'reading_status') {
    text = `${activity.statusLabel} "${activity.bookTitle}"`;
  } else {
    text = activity.type;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
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
