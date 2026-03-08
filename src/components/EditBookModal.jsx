import { useState } from 'react';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { fetchByISBN, searchByTitleAuthor as olSearch } from '../lib/openLibrary';
import { searchByISBN as gbISBN, searchByTitleAuthor as gbSearch } from '../lib/googleBooks';

const GENRES = [
  'Ficcion', 'No ficcion', 'Ciencia ficcion', 'Fantasia', 'Misterio',
  'Romance', 'Historia', 'Ciencia', 'Filosofia', 'Biografia',
  'Autoayuda', 'Negocios', 'Arte', 'Poesia', 'Infantil', 'Otro',
];

const LANGUAGES = [
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'Ingles' },
  { value: 'pt', label: 'Portugues' },
  { value: 'fr', label: 'Frances' },
  { value: 'de', label: 'Aleman' },
  { value: 'it', label: 'Italiano' },
  { value: 'other', label: 'Otro' },
];

/**
 * Map a free-text genre string from APIs to one of our standard genres.
 */
function mapGenre(genreStr) {
  if (!genreStr) return '';
  const mapping = [
    [/fic[ct]i[oó]n|novel|literary/i, 'Ficcion'],
    [/non.?fic|no.?ficc/i, 'No ficcion'],
    [/sci.?fi|science.?fic|ciencia.?fic/i, 'Ciencia ficcion'],
    [/fantas[yí]/i, 'Fantasia'],
    [/myster|thriller|suspens|misterio/i, 'Misterio'],
    [/roman[ct]/i, 'Romance'],
    [/histor/i, 'Historia'],
    [/scien[ct]|ciencia/i, 'Ciencia'],
    [/philos|filosof/i, 'Filosofia'],
    [/biograph|biograf|memoir/i, 'Biografia'],
    [/self.?help|autoayuda|personal/i, 'Autoayuda'],
    [/business|negocio|econom|financ/i, 'Negocios'],
    [/art(?!if)/i, 'Arte'],
    [/poet|poes/i, 'Poesia'],
    [/child|infant|juvenil|kid/i, 'Infantil'],
  ];
  for (const [regex, mapped] of mapping) {
    if (regex.test(genreStr)) return mapped;
  }
  return '';
}

/**
 * EditBookModal — Edit all metadata fields of an existing book.
 * Opens on top of BookModal (z-index 1001).
 * Supports ISBN and title+author search from Google Books / Open Library.
 *
 * Unlike UploadModal, search results OVERWRITE current fields (not just fill empty ones),
 * because the user is explicitly seeking updated metadata.
 */
export default function EditBookModal({ book, onClose, onSaved }) {
  const { updateBook } = useBooks();
  const { toast } = useToast();

  // Pre-fill with current book values
  const [title, setTitle] = useState(book.title || '');
  const [author, setAuthor] = useState(book.author || '');
  const [genre, setGenre] = useState(book.genre || '');
  const [language, setLanguage] = useState(book.language || 'es');
  const [description, setDescription] = useState(book.description || '');
  const [coverUrl, setCoverUrl] = useState(book.coverUrl || '');
  const [isbn, setIsbn] = useState(book.isbn || '');

  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);

  // --- Search by ISBN ---
  const handleISBNSearch = async () => {
    if (!isbn.trim()) return;
    setFetchingMeta(true);
    try {
      const [olResult, gbResult] = await Promise.allSettled([
        fetchByISBN(isbn),
        gbISBN(isbn),
      ]);

      const ol = olResult.status === 'fulfilled' ? olResult.value : null;
      const gb = gbResult.status === 'fulfilled' ? gbResult.value : null;

      const best = gb || ol;
      if (best) {
        if (best.title) setTitle(best.title);
        if (best.author) setAuthor(best.author);
        if (best.description) setDescription(best.description);
        if (best.genre) {
          const mapped = mapGenre(best.genre);
          if (mapped) setGenre(mapped);
        }
        const bestCover = gb?.coverUrl || ol?.coverUrl || '';
        if (bestCover) setCoverUrl(bestCover);
        if (best.language) setLanguage(best.language);

        toast('Metadata encontrada!', 'success');
      } else {
        toast('No se encontro el ISBN en ninguna base de datos', 'info');
      }
    } catch {
      toast('Error al buscar ISBN', 'error');
    } finally {
      setFetchingMeta(false);
    }
  };

  // --- Search by title+author ---
  const handleTitleSearch = async () => {
    if (!title.trim()) return;
    setFetchingMeta(true);
    try {
      const [gbResult, olResult] = await Promise.allSettled([
        gbSearch(title, author),
        olSearch(title, author),
      ]);

      const gb = gbResult.status === 'fulfilled' ? gbResult.value : null;
      const ol = olResult.status === 'fulfilled' ? olResult.value : null;

      const best = gb || ol;
      if (best) {
        if (best.description) setDescription(best.description);
        if (best.genre) {
          const mapped = mapGenre(best.genre);
          if (mapped) setGenre(mapped);
        }
        const bestCover = gb?.coverUrl || ol?.coverUrl || '';
        if (bestCover) setCoverUrl(bestCover);
        if (best.isbn) setIsbn(best.isbn);
        if (best.language) setLanguage(best.language);

        toast('Metadata encontrada!', 'success');
      } else {
        toast('No se encontraron resultados', 'info');
      }
    } catch {
      toast('Error al buscar metadata', 'error');
    } finally {
      setFetchingMeta(false);
    }
  };

  // --- Save ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    setSaving(true);
    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim(),
        genre,
        language,
        description: description.trim(),
        coverUrl: coverUrl.trim(),
        isbn: isbn.trim() || null,
      });
      toast('Libro actualizado', 'success');
      if (onSaved) onSaved();
      onClose();
    } catch {
      toast('Error al actualizar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
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
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 28,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
            Editar libro
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>
            X
          </button>
        </div>

        {/* Cover preview */}
        {coverUrl && (
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 16,
            padding: 12,
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
          }}>
            <img
              src={coverUrl}
              alt="Portada"
              style={{
                width: 80,
                height: 120,
                objectFit: 'cover',
                borderRadius: 4,
                flexShrink: 0,
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && (
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 15,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {title}
                </div>
              )}
              {author && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {author}
                </div>
              )}
              {isbn && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  ISBN: {isbn}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fetching indicator */}
        {fetchingMeta && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Buscando metadata...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ISBN */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              ISBN
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleISBNSearch}
                disabled={fetchingMeta || !isbn.trim()}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                {fetchingMeta ? '...' : 'Buscar'}
              </button>
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              Titulo *
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              {title.trim() && !fetchingMeta && (
                <button
                  type="button"
                  onClick={handleTitleSearch}
                  disabled={fetchingMeta}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                  title="Buscar metadata por titulo y autor"
                >
                  Buscar metadata
                </button>
              )}
            </div>
          </div>

          {/* Author */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              Autor *
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          {/* Genre + Language row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Genero
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Sin genero</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Idioma *
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              Descripcion
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Cover URL */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              URL de la portada
            </label>
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%' }}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !title.trim() || !author.trim() || fetchingMeta}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
