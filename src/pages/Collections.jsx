import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useCollections } from '../hooks/useCollections';
import { useToast } from '../hooks/useToast';
import Avatar from '../components/Avatar';

export default function Collections() {
  const { user } = useAuth();
  const { books } = useBooks();
  const { collections, loading, createCollection, deleteCollection } = useCollections();
  const { toast } = useToast();

  const getCollectionCovers = (col) => {
    if (!col.bookIds?.length) return [];
    return col.bookIds
      .map((bid) => books.find((b) => b.id === bid))
      .filter((b) => b?.coverUrl)
      .slice(0, 4)
      .map((b) => b.coverUrl);
  };

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createCollection(newName.trim(), newDesc.trim());
      toast('Coleccion creada', 'success');
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    } catch {
      toast('Error al crear coleccion', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (col) => {
    try {
      await deleteCollection(col.id);
      toast('Coleccion eliminada', 'info');
    } catch {
      toast('Error al eliminar', 'error');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
      }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Colecciones</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancelar' : '+ Nueva coleccion'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la coleccion"
            required
            style={{ width: '100%' }}
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descripcion (opcional)"
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={creating || !newName.trim()}
            style={{ alignSelf: 'flex-end' }}
          >
            {creating ? 'Creando...' : 'Crear'}
          </button>
        </form>
      )}

      {collections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          No hay colecciones todavia. Crea la primera!
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {collections.map((col) => (
            <Link
              key={col.id}
              to={`/collections/${col.id}`}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                padding: 20,
                textDecoration: 'none',
                color: 'var(--text)',
                transition: 'transform var(--transition), box-shadow var(--transition)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Cover previews */}
              {(() => {
                const covers = getCollectionCovers(col);
                return covers.length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    {covers.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        style={{
                          width: 40,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 3,
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ))}
                  </div>
                ) : null;
              })()}
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>
                {col.name}
              </h3>
              {col.description && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {col.description}
                </p>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'auto',
                paddingTop: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
                  <Avatar src={null} name={col.createdBy?.displayName} size={18} />
                  <span>{col.createdBy?.displayName}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {col.bookIds?.length || 0} {(col.bookIds?.length || 0) === 1 ? 'libro' : 'libros'}
                </span>
              </div>

              {col.createdBy?.uid === user?.uid && (
                <button
                  className="btn-ghost"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(col); }}
                  style={{ fontSize: 11, color: 'var(--danger)', alignSelf: 'flex-end', padding: '2px 6px' }}
                >
                  Eliminar
                </button>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
