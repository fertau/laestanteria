import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBooks } from '../hooks/useBooks';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import BookGrid from '../components/BookGrid';
import BookModal from '../components/BookModal';
import UploadModal from '../components/UploadModal';
import ImportModal from '../components/ImportModal';
import SelectionActionBar from '../components/SelectionActionBar';

const GENRES = [
  'Ficcion', 'No ficcion', 'Ciencia ficcion', 'Fantasia', 'Misterio',
  'Romance', 'Historia', 'Ciencia', 'Filosofia', 'Biografia',
  'Autoayuda', 'Negocios', 'Arte', 'Poesia', 'Infantil', 'Otro',
];

const LANGUAGES = [
  { value: '', label: 'Todos' },
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'Ingles' },
  { value: 'pt', label: 'Portugues' },
  { value: 'fr', label: 'Frances' },
  { value: 'de', label: 'Aleman' },
  { value: 'it', label: 'Italiano' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Mas recientes' },
  { value: 'title', label: 'Titulo A-Z' },
  { value: 'author', label: 'Autor A-Z' },
  { value: 'rating', label: 'Mejor valorados' },
];

export default function Catalog() {
  const { books, loading, hasFollows, deleteBooks } = useBooks();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showUpload, setShowUpload] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  // --- Selection mode state ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const filtered = useMemo(() => {
    let result = [...books];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q)
      );
    }

    // Genre
    if (genreFilter) {
      result = result.filter((b) => b.genre === genreFilter);
    }

    // Language
    if (langFilter) {
      result = result.filter((b) => b.language === langFilter);
    }

    // Sort
    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        result.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'rating': {
        const avg = (bk) =>
          bk.ratingCount > 0 ? bk.ratingSum / bk.ratingCount : 0;
        result.sort((a, b) => avg(b) - avg(a));
        break;
      }
      default: // recent
        result.sort((a, b) => {
          const ta = a.uploadedAt?.seconds || 0;
          const tb = b.uploadedAt?.seconds || 0;
          return tb - ta;
        });
    }

    return result;
  }, [books, search, genreFilter, langFilter, sortBy]);

  // --- Selection derived values ---
  const selectableIds = useMemo(
    () => new Set(filtered.filter((b) => b.uploadedBy?.uid === user?.uid).map((b) => b.id)),
    [filtered, user]
  );

  const selectedCount = useMemo(
    () => [...selectedIds].filter((id) => selectableIds.has(id)).length,
    [selectedIds, selectableIds]
  );

  const allSelectableSelected = selectableIds.size > 0
    && [...selectableIds].every((id) => selectedIds.has(id));

  // --- Selection handlers ---
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(selectableIds));
  }, [selectableIds]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  }, []);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const idsToDelete = [...selectedIds].filter((id) => selectableIds.has(id));
      await deleteBooks(idsToDelete);
      toast(
        `${idsToDelete.length} ${idsToDelete.length === 1 ? 'libro eliminado' : 'libros eliminados'}`,
        'success'
      );
      exitSelectionMode();
    } catch (err) {
      toast('Error al eliminar libros: ' + err.message, 'error');
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const handleBulkUpdateMetadata = () => {
    const ids = [...selectedIds].filter((id) => selectableIds.has(id));
    navigate('/catalog/batch', { state: { preSelectedIds: ids } });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton skeleton-title" style={{ marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="page"
      style={selectionMode && selectedCount > 0 ? { paddingBottom: 140 } : undefined}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Catalogo</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!selectionMode && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setShowUpload(true)}
              >
                + Subir libro
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowImport(true)}
              >
                Importar
              </button>
              {books.some((b) => b.uploadedBy?.uid === user?.uid) && (
                <Link
                  to="/catalog/batch"
                  className="btn btn-secondary"
                  style={{ fontSize: 13, textDecoration: 'none' }}
                >
                  Actualizar metadata
                </Link>
              )}
            </>
          )}
          <button
            className={selectionMode ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            style={{ fontSize: 13 }}
          >
            {selectionMode ? 'Cancelar seleccion' : 'Seleccionar'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar titulo, autor..."
          style={{ flex: 1, minWidth: 180 }}
        />
        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          style={{ minWidth: 130 }}
        >
          <option value="">Todo genero</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          style={{ minWidth: 110 }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ minWidth: 140 }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Selection bar */}
      {selectionMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          marginBottom: 12,
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}>
            <input
              type="checkbox"
              checked={allSelectableSelected}
              onChange={() => allSelectableSelected ? deselectAll() : selectAll()}
            />
            Seleccionar todos ({selectableIds.size})
          </label>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {selectedCount} {selectedCount === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
        </div>
      )}

      {/* Results info */}
      {!selectionMode && (
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 16,
        }}>
          {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'}
          {search.trim() || genreFilter || langFilter ? ' encontrados' : ' en tu catalogo'}
        </div>
      )}

      {/* Empty state */}
      {books.length === 0 && !hasFollows && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>Estanteria vacia</div>
          <p style={{ marginBottom: 16 }}>
            Subi tu primer libro o segui a alguien para ver su biblioteca.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowUpload(true)}
          >
            + Subir tu primer libro
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <BookGrid
          books={filtered}
          onBookClick={selectionMode ? undefined : setSelectedBook}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          selectableIds={selectableIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* No results for filters */}
      {filtered.length === 0 && books.length > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-muted)',
        }}>
          No se encontraron libros con esos filtros.
        </div>
      )}

      {/* Selection action bar */}
      {selectionMode && selectedCount > 0 && (
        <SelectionActionBar
          count={selectedCount}
          onDelete={handleBulkDelete}
          onUpdateMetadata={handleBulkUpdateMetadata}
          confirmDelete={confirmBulkDelete}
          setConfirmDelete={setConfirmBulkDelete}
          deleting={bulkDeleting}
        />
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}
