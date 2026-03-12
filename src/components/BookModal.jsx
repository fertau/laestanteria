import { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useCollections } from '../hooks/useCollections';
import { useFollows } from '../hooks/useFollows';
import { useBonds } from '../hooks/useBonds';
import { useRequests } from '../hooks/useRequests';
import { useRatings } from '../hooks/useRatings';
import { useReadingStatus } from '../hooks/useReadingStatus';
import { useToast } from '../hooks/useToast';
import { functions } from '../lib/firebase';
import { getEpub, hasEpub } from '../lib/localStore';
import Stars from './Stars';
import Avatar from './Avatar';
import EditBookModal from './EditBookModal';

const langLabels = {
  es: 'Espanol', en: 'Ingles', pt: 'Portugues',
  fr: 'Frances', de: 'Aleman', it: 'Italiano',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Sin estado' },
  { value: 'want', label: 'Quiero leer' },
  { value: 'reading', label: 'Leyendo' },
  { value: 'finished', label: 'Leido' },
];

export default function BookModal({ book, onClose }) {
  const { user } = useAuth();
  const { deleteBook } = useBooks();
  const { collections, addBookToCollection, removeBookFromCollection } = useCollections();
  const { canDownloadFrom } = useFollows();
  const { hasBondWith } = useBonds();
  const { requestBooks } = useRequests();
  const { myRating, rate, removeRating } = useRatings(book.id);
  const { status: readingStatus, setReadingStatus } = useReadingStatus(book.id);
  const { toast } = useToast();

  const [sendingKindle, setSendingKindle] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [hasLocal, setHasLocal] = useState(false);

  // Click-outside protection: only close if mousedown AND mouseup both hit the overlay
  // (prevents close when user scrolls or drags accidentally)
  const mouseDownTarget = useRef(null);

  const isOwner = book.uploadedBy?.uid === user?.uid;
  const canDownload = canDownloadFrom(book.uploadedBy?.uid);
  const isBonded = hasBondWith(book.uploadedBy?.uid);
  const avgRating = book.ratingCount > 0 ? (book.ratingSum / book.ratingCount).toFixed(1) : null;

  // Check if EPUB is available locally
  useEffect(() => {
    if (book.fileHash) {
      hasEpub(book.fileHash).then(setHasLocal);
    }
  }, [book.fileHash]);

  const handleRate = async (value) => {
    try {
      if (value === 0) {
        await removeRating();
        toast('Rating eliminado', 'info');
      } else {
        await rate(value);
        toast('Rating guardado', 'success');
      }
    } catch {
      toast('Error al guardar rating', 'error');
    }
  };

  const handleStatusChange = async (e) => {
    try {
      await setReadingStatus(e.target.value || null);
      toast('Estado actualizado', 'success');
    } catch {
      toast('Error al actualizar estado', 'error');
    }
  };

  // Send own book to own Kindle (book is local)
  const handleSendToMyKindle = async () => {
    if (!user.kindleEmail) {
      toast('Configura tu email Kindle en tu perfil primero', 'info');
      return;
    }
    if (!book.fileHash) {
      toast('Este libro no tiene archivo asociado', 'error');
      return;
    }
    setSendingKindle(true);
    try {
      const file = await getEpub(book.fileHash);
      if (!file) {
        toast('Archivo EPUB no encontrado localmente', 'error');
        return;
      }
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const fn = httpsCallable(functions, 'sendToKindle');
      await fn({
        kindleEmail: user.kindleEmail,
        bookTitle: book.title,
        bookAuthor: book.author,
        epubBase64: base64,
      });
      toast('Libro enviado a tu Kindle!', 'success');
    } catch {
      toast('Error al enviar a Kindle', 'error');
    } finally {
      setSendingKindle(false);
    }
  };

  // Request book to be sent to my Kindle (book belongs to someone else)
  const handleRequestToKindle = async () => {
    setRequesting(true);
    try {
      await requestBooks(
        book.uploadedBy.uid,
        book.uploadedBy.displayName,
        [book]
      );
      toast(`Pedido enviado a ${book.uploadedBy.displayName}`, 'success');
    } catch {
      toast('Error al enviar pedido', 'error');
    } finally {
      setRequesting(false);
    }
  };

  // Collections for this book
  const bookCollections = collections.filter((c) => c.bookIds?.includes(book.id));
  const availableCollections = collections.filter(
    (c) => !c.bookIds?.includes(book.id) && c.createdBy?.uid === user?.uid
  );

  const handleAddToCollection = async (colId) => {
    try {
      await addBookToCollection(colId, book.id);
      toast('Agregado a la coleccion', 'success');
    } catch {
      toast('Error al agregar', 'error');
    }
  };

  const handleRemoveFromCollection = async (colId) => {
    try {
      await removeBookFromCollection(colId, book.id);
      toast('Removido de la coleccion', 'info');
    } catch {
      toast('Error al remover', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteBook(book.id);
      toast('Libro eliminado', 'success');
      onClose();
    } catch {
      toast('Error al eliminar', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onMouseUp={(e) => {
        // Close only if BOTH mousedown and mouseup happened on the overlay itself
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
          onClose();
        }
        mouseDownTarget.current = null;
      }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: 600,
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px 0',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
            Detalle del libro
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>
            X
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          <div style={{
            display: 'flex',
            gap: 20,
            marginBottom: 20,
          }}>
            {/* Cover */}
            <div style={{
              width: 140,
              minWidth: 140,
              aspectRatio: '2/3',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              background: 'var(--surface)',
              flexShrink: 0,
            }}>
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 12,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #1a1510 0%, #0f0c08 100%)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
                    {book.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {book.author}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                lineHeight: 1.3,
                marginBottom: 4,
              }}>
                {book.title}
              </h3>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
                {book.author}
              </div>

              {/* Meta badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {book.language && (
                  <span style={badgeStyle}>
                    {langLabels[book.language] || book.language}
                  </span>
                )}
                {book.genre && (
                  <span style={badgeStyle}>{book.genre}</span>
                )}
                {book.isbn && (
                  <span style={badgeStyle}>ISBN: {book.isbn}</span>
                )}
              </div>

              {/* Average rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {avgRating ? (
                  <>
                    <Stars value={parseFloat(avgRating)} readOnly size={16} />
                    <span style={{ fontSize: 14, color: 'var(--accent)' }}>{avgRating}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      ({book.ratingCount} {book.ratingCount === 1 ? 'voto' : 'votos'})
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Sin valoraciones</span>
                )}
              </div>

              {/* Uploader */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <Avatar src={null} name={book.uploadedBy?.displayName} size={20} />
                <span>Subido por {book.uploadedBy?.displayName}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                Descripcion
              </div>
              <p style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}>
                {book.description}
              </p>
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {/* My rating */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
              Tu valoracion
            </div>
            <Stars value={myRating || 0} onChange={handleRate} size={24} />
          </div>

          {/* Reading status */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
              Estado de lectura
            </div>
            <select
              value={readingStatus || ''}
              onChange={handleStatusChange}
              style={{ minWidth: 160 }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Collections */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
              Colecciones
            </div>
            {bookCollections.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {bookCollections.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 12,
                    }}
                  >
                    {c.name}
                    {c.createdBy?.uid === user?.uid && (
                      <button
                        onClick={() => handleRemoveFromCollection(c.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-dim)',
                          fontSize: 12,
                          padding: '0 2px',
                          lineHeight: 1,
                        }}
                        title="Quitar de esta coleccion"
                      >
                        x
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {availableCollections.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddToCollection(e.target.value);
                }}
                style={{ fontSize: 12, minWidth: 180 }}
              >
                <option value="">+ Agregar a coleccion...</option>
                {availableCollections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {bookCollections.length === 0 && availableCollections.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                No hay colecciones disponibles
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Owner actions: send to own Kindle + edit/delete */}
              {isOwner && hasLocal && (
                <button
                  className="btn btn-primary"
                  onClick={handleSendToMyKindle}
                  disabled={sendingKindle}
                  style={{ fontSize: 13 }}
                >
                  {sendingKindle ? 'Enviando...' : 'Enviar a mi Kindle'}
                </button>
              )}

              {/* Bonded user: request to their Kindle */}
              {!isOwner && isBonded && (
                <button
                  className="btn btn-primary"
                  onClick={handleRequestToKindle}
                  disabled={requesting}
                  style={{ fontSize: 13 }}
                >
                  {requesting ? 'Enviando pedido...' : 'Pedir a mi Kindle'}
                </button>
              )}

              {/* Legacy follow with library access: also allow requesting */}
              {!isOwner && !isBonded && canDownload && (
                <button
                  className="btn btn-primary"
                  onClick={handleRequestToKindle}
                  disabled={requesting}
                  style={{ fontSize: 13 }}
                >
                  {requesting ? 'Enviando pedido...' : 'Pedir a mi Kindle'}
                </button>
              )}

              {/* No access */}
              {!isOwner && !isBonded && !canDownload && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                  Necesitas un vinculo activo para pedir este libro.
                </div>
              )}

              {isOwner && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowEdit(true)}
                    style={{ fontSize: 13 }}
                  >
                    Editar
                  </button>
                  <button
                    className={confirmDelete ? 'btn btn-danger' : 'btn btn-ghost'}
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ fontSize: 13, marginLeft: 'auto', color: confirmDelete ? '#fff' : 'var(--danger)' }}
                  >
                    {deleting ? 'Eliminando...' : confirmDelete ? 'Confirmar eliminacion' : 'Eliminar libro'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditBookModal
          book={book}
          onClose={() => setShowEdit(false)}
          onSaved={onClose}
        />
      )}
    </div>
  );
}

const badgeStyle = {
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 8px',
  borderRadius: 4,
  border: '1px solid var(--border)',
};
