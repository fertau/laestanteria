import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useFollows } from '../hooks/useFollows';
import { useAllReadingStatuses } from '../hooks/useReadingStatus';
import { useToast } from '../hooks/useToast';
import BookGrid from '../components/BookGrid';
import BookModal from '../components/BookModal';

export default function Profile() {
  const { uid } = useParams();
  const { user, profile, updateProfile, generateInviteCode, getMyInviteCodes } = useAuth();
  const { books } = useBooks();
  const { following, followers } = useFollows();
  const { wantToRead, reading, finished } = useAllReadingStatuses();
  const { toast } = useToast();
  const isOwnProfile = user?.uid === uid;

  const [profileData, setProfileData] = useState(null);
  const [kindleEmail, setKindleEmail] = useState('');
  const [inviteCodes, setInviteCodes] = useState([]);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  // Books uploaded by this user
  const myBooks = useMemo(
    () => books.filter((b) => b.uploadedBy?.uid === uid),
    [books, uid]
  );

  // Reading status books (resolve IDs to book objects)
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

  useEffect(() => {
    if (isOwnProfile) {
      getMyInviteCodes().then(setInviteCodes);
    }
  }, [isOwnProfile, getMyInviteCodes]);

  const handleSaveKindle = async () => {
    if (kindleEmail && !kindleEmail.endsWith('@kindle.com')) {
      toast('El email debe terminar en @kindle.com', 'error');
      return;
    }
    await updateProfile({ kindleEmail: kindleEmail || null });
    toast('Email Kindle guardado', 'success');
  };

  const handleGenerateCode = async () => {
    try {
      const code = await generateInviteCode();
      setGeneratedCode(code);
      setInviteCodes((prev) => [
        { code, generatedBy: user.uid, usedBy: null, createdAt: new Date() },
        ...prev,
      ]);
      toast('Codigo generado!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast('Copiado al portapapeles', 'info');
  };

  const shareWhatsApp = (code) => {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const text = `Te invito a La estanteria! Usa este codigo para registrarte: ${code}\n${appUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        {profileData.avatar ? (
          <img
            src={profileData.avatar}
            alt=""
            style={{ width: 72, height: 72, borderRadius: '50%' }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
          }}>
            {(profileData.displayName || '?')[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>
            {profileData.displayName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{profileData.email}</p>
        </div>
      </div>

      {/* Stats overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 8,
        marginBottom: 32,
      }}>
        <MiniStat label="Subidos" value={myBooks.length} />
        {isOwnProfile && (
          <>
            <MiniStat label="Quiero leer" value={wantToRead.length} />
            <MiniStat label="Leyendo" value={reading.length} />
            <MiniStat label="Leidos" value={finished.length} />
            <MiniStat label="Siguiendo" value={following.length} />
            <MiniStat label="Seguidores" value={followers.length} />
          </>
        )}
      </div>

      {/* My uploaded books */}
      {myBooks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Libros subidos</h2>
          <BookGrid books={myBooks} onBookClick={setSelectedBook} />
        </section>
      )}

      {/* Reading status sections (own profile only) */}
      {isOwnProfile && readingBooks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Leyendo</h2>
          <BookGrid books={readingBooks} onBookClick={setSelectedBook} />
        </section>
      )}

      {isOwnProfile && wantBooks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Quiero leer</h2>
          <BookGrid books={wantBooks} onBookClick={setSelectedBook} />
        </section>
      )}

      {isOwnProfile && finishedBooks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Leidos</h2>
          <BookGrid books={finishedBooks} onBookClick={setSelectedBook} />
        </section>
      )}

      {/* Own profile sections */}
      {isOwnProfile && (
        <>
          {/* Kindle config */}
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title">Configuracion Kindle</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              Para recibir libros en tu Kindle, ingresa tu direccion @kindle.com y autoriza el remitente en{' '}
              <a href="https://www.amazon.com/mycd" target="_blank" rel="noopener noreferrer">
                amazon.com/mycd
              </a>
              {' '}→ Preferences → Approved Personal Document E-mail List.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={kindleEmail}
                onChange={(e) => setKindleEmail(e.target.value)}
                placeholder="tu-email@kindle.com"
                style={{ flex: 1 }}
              />
              <button onClick={handleSaveKindle} className="btn btn-primary">
                Guardar
              </button>
            </div>
          </div>

          {/* Privacy mode */}
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title">Privacidad</h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  Modo {profile.privacyMode === 'open' ? 'abierto' : 'cerrado'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {profile.privacyMode === 'open'
                    ? 'Nuevos seguidores ven tu actividad automaticamente'
                    : 'Aprobas cada solicitud y elegis que compartir'}
                </div>
              </div>
              <button
                onClick={() =>
                  updateProfile({
                    privacyMode: profile.privacyMode === 'open' ? 'closed' : 'open',
                  })
                }
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
              >
                Cambiar a {profile.privacyMode === 'open' ? 'cerrado' : 'abierto'}
              </button>
            </div>
          </div>

          {/* Invite codes */}
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title">Codigos de invitacion</h2>
            <button onClick={handleGenerateCode} className="btn btn-primary" style={{ marginBottom: 16 }}>
              Generar codigo
            </button>

            {generatedCode && (
              <div style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                padding: 16,
                marginBottom: 16,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Nuevo codigo generado:
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: 'var(--accent)',
                  marginBottom: 12,
                }}>
                  {generatedCode}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => copyToClipboard(generatedCode)}
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    Copiar
                  </button>
                  <button
                    onClick={() => shareWhatsApp(generatedCode)}
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    Compartir por WhatsApp
                  </button>
                </div>
              </div>
            )}

            {inviteCodes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {inviteCodes.map((ic) => (
                  <div
                    key={ic.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius)',
                      padding: '8px 12px',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ic.code}</span>
                    <span style={{ color: ic.usedBy ? 'var(--success)' : 'var(--text-muted)' }}>
                      {ic.usedBy ? 'Usado' : 'Disponible'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      padding: '12px 8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
