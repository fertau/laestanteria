import { useState, useMemo } from 'react';
import { useBooks } from '../hooks/useBooks';
import BookGrid from '../components/BookGrid';
import BookModal from '../components/BookModal';
import UploadModal from '../components/UploadModal';

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
  const { books, loading, hasFollows } = useBooks();

  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

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
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Catalogo</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowUpload(true)}
        >
          + Subir libro
        </button>
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

      {/* Results info */}
      <div style={{
        fontSize: 13,
        color: 'var(--text-muted)',
        marginBottom: 16,
      }}>
        {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'}
        {search.trim() || genreFilter || langFilter ? ' encontrados' : ' en tu catalogo'}
      </div>

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
        <BookGrid books={filtered} onBookClick={setSelectedBook} />
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

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
    </div>
  );
}
