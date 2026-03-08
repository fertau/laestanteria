import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useCollections } from '../hooks/useCollections';
import { useToast } from '../hooks/useToast';
import BookGrid from '../components/BookGrid';
import BookModal from '../components/BookModal';

export default function CollectionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { books } = useBooks();
  const { collections, addBookToCollection, removeBookFromCollection, updateCollection } = useCollections();
  const { toast } = useToast();

  const [selectedBook, setSelectedBook] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [addSearch, setAddSearch] = useState('');

  const col = collections.find((c) => c.id === id);

  const colBooks = useMemo(() => {
    if (!col?.bookIds) return [];
    return col.bookIds
      .map((bid) => books.find((b) => b.id === bid))
      .filter(Boolean);
  }, [col, books]);

  // Books not in this collection (for adding)
  const availableBooks = useMemo(() => {
    if (!col?.bookIds) return books;
    return books.filter((b) => !col.bookIds.includes(b.id));
  }, [col, books]);

  const filteredAvailable = useMemo(() => {
    if (!addSearch.trim()) return availableBooks.slice(0, 30);
    const q = addSearch.toLowerCase().trim();
    return availableBooks
      .filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .slice(0, 30);
  }, [availableBooks, addSearch]);

  const isOwner = col?.createdBy?.uid === user?.uid;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast('Link copiado al portapapeles', 'success');
  };

  const handleAddBook = async (bookId) => {
    try {
      await addBookToCollection(id, bookId);
      toast('Libro agregado a la coleccion', 'success');
    } catch {
      toast('Error', 'error');
    }
  };

  const handleRemoveBook = async (bookId) => {
    try {
      await removeBookFromCollection(id, bookId);
      toast('Libro removido de la coleccion', 'info');
    } catch {
      toast('Error', 'error');
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updateCollection(id, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      toast('Coleccion actualizada', 'success');
      setEditing(false);
    } catch {
      toast('Error', 'error');
    }
  };

  if (!col) {
    return (
      <div className="page">
        <p style={{ color: 'var(--text-muted)' }}>Coleccion no encontrada.</p>
        <Link to="/collections" style={{ fontSize: 13 }}>Volver a colecciones</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/collections" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}>
        Volver a colecciones
      </Link>

      {editing ? (
        <div style={{ marginBottom: 20 }}>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            style={{ width: '100%', marginBottom: 8, fontSize: 18, fontWeight: 600 }}
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            style={{ width: '100%', marginBottom: 8, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSaveEdit} style={{ fontSize: 13 }}>
              Guardar
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>{col.name}</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                onClick={handleShare}
              >
                Compartir
              </button>
              {isOwner && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => { setEditName(col.name); setEditDesc(col.description || ''); setEditing(true); }}
                >
                  Editar
                </button>
              )}
            </div>
          </div>
          {col.description && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{col.description}</p>
          )}
        </div>
      )}

      {/* Books in collection */}
      <section style={{ marginBottom: 32 }}>
        <h3 className="section-title">
          Libros ({colBooks.length})
        </h3>
        {colBooks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            Esta coleccion esta vacia. Agrega libros del catalogo.
          </p>
        ) : (
          <>
            <BookGrid books={colBooks} onBookClick={setSelectedBook} />
            {isOwner && (
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {colBooks.map((b) => (
                  <button
                    key={b.id}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => handleRemoveBook(b.id)}
                  >
                    Quitar "{b.title}"
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Add books */}
      {isOwner && availableBooks.length > 0 && (
        <section>
          <h3 className="section-title">Agregar libros</h3>
          <input
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="Buscar por titulo o autor..."
            style={{ width: '100%', marginBottom: 10 }}
          />
          {filteredAvailable.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>
              No se encontraron libros
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredAvailable.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    {b.coverUrl ? (
                      <img
                        src={b.coverUrl}
                        alt=""
                        style={{
                          width: 30,
                          height: 45,
                          objectFit: 'cover',
                          borderRadius: 3,
                          flexShrink: 0,
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{
                        width: 30,
                        height: 45,
                        background: 'var(--bg)',
                        borderRadius: 3,
                        flexShrink: 0,
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.author}</div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                      onClick={() => handleAddBook(b.id)}
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
              {!addSearch.trim() && availableBooks.length > 30 && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8 }}>
                  Usa el buscador para ver mas libros ({availableBooks.length} disponibles)
                </div>
              )}
            </>
          )}
        </section>
      )}

      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}
