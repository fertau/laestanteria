import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useFollows } from '../hooks/useFollows';
import { useAllReadingStatuses } from '../hooks/useReadingStatus';
import { useToast } from '../hooks/useToast';
import BookCard from '../components/BookCard';
import BookModal from '../components/BookModal';
import { Upload, BookOpen, BookMarked, Star, Layers, Settings, Tablet, Shield, HelpCircle } from 'lucide-react';

export default function Profile() {
  const { uid } = useParams();
  const { user, profile, updateProfile } = useAuth();
  const { books } = useBooks();
  const { following, followers } = useFollows();
  const { wantToRead, reading, finished } = useAllReadingStatuses();
  const { toast } = useToast();
  const isOwnProfile = user?.uid === uid;

  const [profileData, setProfileData] = useState(null);
  const [kindleEmail, setKindleEmail] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);

  const myBooks = useMemo(
    () => books.filter((b) => b.uploadedBy?.uid === uid),
    [books, uid]
  );

  const wantBooks = useMemo(
    () => wantToRead.map((id) => books.find((b) => b.id === id)).filter(Boolean),
    [wantToRead, books]
  );
  const readingBooks = useMemo(
    () => reading.map((id) => books.find((b) => b.id === id)).filter(Boolean),
    [reading, books]
  );
  const finishedBooks = useMemo(
    () => finished.map((id) => books.find((b) => b.id === id)).filter(Boolean),
    [finished, books]
  );

  // Books that user has rated
  const ratedBooks = useMemo(
    () => books.filter((b) => b.ratings && b.ratings[uid]),
    [books, uid]
  );

  useEffect(() => {
    if (isOwnProfile && profile) {
      setProfileData(profile);
      setKindleEmail(profile.kindleEmail || '');
    } else {
      getDoc(doc(db, 'users', uid)).then((snap) => {
        if (snap.exists()) setProfileData({ id: snap.id, ...snap.data() });
      });
    }
  }, [uid, isOwnProfile, profile]);

  const handleSaveKindle = async () => {
    if (kindleEmail && !kindleEmail.endsWith('@kindle.com')) {
      toast('El email debe terminar en @kindle.com', 'error');
      return;
    }
    await updateProfile({ kindleEmail: kindleEmail || null });
    toast('Email Kindle guardado', 'success');
  };


  if (!profileData) {
    return (
      <div className="page">
        <div className="loading-screen">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* ═══ Mi Perfil ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
        {profileData.avatar ? (
          <img
            src={profileData.avatar}
            alt=""
            style={{ width: 64, height: 64, borderRadius: '50%' }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700,
          }}>
            {(profileData.displayName || '?')[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 2 }}>
            {profileData.displayName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{profileData.email}</p>
        </div>
      </div>

      {isOwnProfile && (
        <>
          {/* ═══ Mis Libros ═══ */}
          <h2 className="section-title" style={{ marginBottom: 12 }}>Mis libros</h2>

          {/* Book category rows */}
          <BookRow
            icon={Upload}
            label="Subidos"
            count={myBooks.length}
            books={myBooks}
            onBookClick={setSelectedBook}
            linkTo="/catalog"
          />
          <BookRow
            icon={BookOpen}
            label="Leyendo"
            count={readingBooks.length}
            books={readingBooks}
            onBookClick={setSelectedBook}
            linkTo="/catalog"
          />
          <BookRow
            icon={BookMarked}
            label="Quiero leer"
            count={wantBooks.length}
            books={wantBooks}
            onBookClick={setSelectedBook}
            linkTo="/catalog"
          />
          <BookRow
            icon={Star}
            label="Leidos"
            count={finishedBooks.length}
            books={finishedBooks}
            onBookClick={setSelectedBook}
            linkTo="/catalog"
          />
          <BookRow
            icon={Layers}
            label="Colecciones"
            count={null}
            books={[]}
            onBookClick={setSelectedBook}
            linkTo="/collections"
            linkLabel="Ver colecciones →"
          />

          <div className="divider" />

          {/* ═══ Configuraciones ═══ */}
          <h2 className="section-title" style={{ marginBottom: 12 }}>
            <span>Configuraciones</span>
            <Link to="/tutorial" className="section-link">
              <HelpCircle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Tutorial
            </Link>
          </h2>

          {/* Kindle */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 10,
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Tablet size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Email Kindle</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
              Tu direccion @kindle.com para recibir libros. Autoriza el remitente{' '}
              <strong style={{ color: 'var(--text)' }}>ticher@gmail.com</strong> en{' '}
              <a href="https://www.amazon.com/mycd" target="_blank" rel="noopener noreferrer">
                amazon.com/mycd
              </a>{' '}
              → Preferences → Approved Personal Document E-mail List.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={kindleEmail}
                onChange={(e) => setKindleEmail(e.target.value)}
                placeholder="tu-email@kindle.com"
                style={{ flex: 1, fontSize: 13 }}
              />
              <button onClick={handleSaveKindle} className="btn btn-primary" style={{ fontSize: 13 }}>
                Guardar
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 10,
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Shield size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  Modo {profile.privacyMode === 'open' ? 'abierto' : 'cerrado'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                  {profile.privacyMode === 'open'
                    ? 'Nuevos seguidores ven tu actividad automaticamente'
                    : 'Aprobas cada solicitud y elegis que compartir'}
                </div>
              </div>
            </div>
            <button
              onClick={() =>
                updateProfile({
                  privacyMode: profile.privacyMode === 'open' ? 'closed' : 'open',
                })
              }
              className="btn btn-secondary"
              style={{ fontSize: 12, flexShrink: 0 }}
            >
              Cambiar
            </button>
          </div>

        </>
      )}

      {/* Other user's profile — just show uploaded count */}
      {!isOwnProfile && myBooks.length > 0 && (
        <BookRow
          icon={Upload}
          label="Libros subidos"
          count={myBooks.length}
          books={myBooks}
          onBookClick={setSelectedBook}
          linkTo="/catalog"
        />
      )}

      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}

/* ── BookRow: one-line preview with horizontal scroll + "Ver más" ── */
function BookRow({ icon: Icon, label, count, books, onBookClick, linkTo, linkLabel }) {
  const hasBooks = books.length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: hasBooks ? 8 : 0,
        padding: hasBooks ? 0 : '10px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
          {count !== null && (
            <span style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              background: 'var(--surface)',
              padding: '2px 8px',
              borderRadius: 10,
            }}>
              {count}
            </span>
          )}
        </div>
        {(hasBooks || linkLabel) && (
          <Link to={linkTo} style={{ fontSize: 12, color: 'var(--accent)' }}>
            {linkLabel || `Ver mas →`}
          </Link>
        )}
      </div>

      {/* Horizontal scroll of books (max 6) */}
      {hasBooks && (
        <div className="horizontal-scroll">
          {books.slice(0, 6).map((book) => (
            <div key={book.id} style={{ flex: '0 0 100px', maxWidth: 100 }}>
              <BookCard book={book} onClick={onBookClick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
