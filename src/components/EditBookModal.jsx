import { useState, useEffect } from 'react';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { fetchByISBN, searchByTitleAuthor as olSearch, searchCovers as olCovers } from '../lib/openLibrary';
import { searchByISBN as gbISBN, searchByTitleAuthor as gbSearch, searchCovers as gbCovers } from '../lib/googleBooks';

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
 * Includes visual cover picker with multiple options from APIs.
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

  // Cover search state
  const [coverOptions, setCoverOptions] = useState([]);
  const [searchingCovers, setSearchingCovers] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Auto-search covers when opening a book with no cover (or blob: cover)
  useEffect(() => {
    if ((!book.coverUrl || book.coverUrl.startsWith('blob:')) && (book.title || book.isbn)) {
      // Small delay to let the modal render first
      const timer = setTimeout(() => {
        doSearchCovers(book.title || '', book.author || '', book.isbn || '');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Search covers from multiple sources ---
  const doSearchCovers = async (searchTitle, searchAuthor, searchIsbn) => {
    if (!searchTitle && !searchIsbn) return;
    setSearchingCovers(true);
    setCoverOptions([]);
    try {
      const [gbResults, olResults] = await Promise.allSettled([
        gbCovers(searchTitle, searchAuthor, searchIsbn),
        olCovers(searchTitle, searchAuthor, searchIsbn),
      ]);

      const gb = gbResults.status === 'fulfilled' ? gbResults.value : [];
      const ol = olResults.status === 'fulfilled' ? olResults.value : [];

      const all = [...gb, ...ol];
      const seen = new Set();
      const unique = all.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });

      setCoverOptions(unique);

      // Auto-select first cover if current one is empty/blob
      if (unique.length > 0 && (!coverUrl || coverUrl.startsWith('blob:'))) {
        setCoverUrl(unique[0].url);
      }

      if (unique.length === 0) {
        toast('No se encontraron portadas', 'info');
      }
    } catch {
      // Silently fail
    } finally {
      setSearchingCovers(false);
    }
  };

  const handleSearchCovers = async () => {
    if (!title.trim() && !isbn.trim()) {
      toast('Ingresa un titulo o ISBN primero', 'info');
      return;
    }
    setSearchingCovers(true);
    setCoverOptions([]);
    try {
      const [gbResults, olResults] = await Promise.allSettled([
        gbCovers(title, author, isbn),
        olCovers(title, author, isbn),
      ]);

      const gb = gbResults.status === 'fulfilled' ? gbResults.value : [];
      const ol = olResults.status === 'fulfilled' ? olResults.value : [];

      // Merge and deduplicate
      const all = [...gb, ...ol];
      const seen = new Set();
      const unique = all.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });

      setCoverOptions(unique);
      if (unique.length === 0) {
        toast('No se encontraron portadas', 'info');
      }
    } catch {
      toast('Error al buscar portadas', 'error');
    } finally {
      setSearchingCovers(false);
    }
  };

  // --- Search by ISBN (metadata + covers in parallel) ---
  const handleISBNSearch = async () => {
    if (!isbn.trim()) return;
    setFetchingMeta(true);
    setSearchingCovers(true);
    setCoverOptions([]);
    try {
      // Search metadata AND covers in parallel for speed
      const [olResult, gbResult, gbCoverResult, olCoverResult] = await Promise.allSettled([
        fetchByISBN(isbn),
        gbISBN(isbn),
        gbCovers(title, author, isbn),
        olCovers(title, author, isbn),
      ]);

      const ol = olResult.status === 'fulfilled' ? olResult.value : null;
      const gb = gbResult.status === 'fulfilled' ? gbResult.value : null;

      // Apply metadata
      const best = gb || ol;
      if (best) {
        if (best.title) setTitle(best.title);
        if (best.author) setAuthor(best.author);
        if (best.description) setDescription(best.description);
        if (best.genre) {
          const mapped = mapGenre(best.genre);
          if (mapped) setGenre(mapped);
        }
        if (best.language) setLanguage(best.language);
      }

      // Merge cover results
      const gbC = gbCoverResult.status === 'fulfilled' ? gbCoverResult.value : [];
      const olC = olCoverResult.status === 'fulfilled' ? olCoverResult.value : [];
      const all = [...gbC, ...olC];
      const seen = new Set();
      const unique = all.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });
      setCoverOptions(unique);

      // Auto-select best cover (prefer metadata cover, then first from search)
      const bestCover = gb?.coverUrl || ol?.coverUrl || (unique.length > 0 ? unique[0].url : '');
      if (bestCover) setCoverUrl(bestCover);

      if (best || unique.length > 0) {
        toast('Metadata encontrada!', 'success');
      } else {
        toast('No se encontro el ISBN en ninguna base de datos', 'info');
      }
    } catch {
      toast('Error al buscar ISBN', 'error');
    } finally {
      setFetchingMeta(false);
      setSearchingCovers(false);
    }
  };

  // --- Search by title+author (metadata + covers in parallel) ---
  const handleTitleSearch = async () => {
    if (!title.trim()) return;
    setFetchingMeta(true);
    setSearchingCovers(true);
    setCoverOptions([]);
    try {
      const [gbResult, olResult, gbCoverResult, olCoverResult] = await Promise.allSettled([
        gbSearch(title, author),
        olSearch(title, author),
        gbCovers(title, author, isbn),
        olCovers(title, author, isbn),
      ]);

      const gb = gbResult.status === 'fulfilled' ? gbResult.value : null;
      const ol = olResult.status === 'fulfilled' ? olResult.value : null;

      // Apply metadata
      const best = gb || ol;
      if (best) {
        if (best.description) setDescription(best.description);
        if (best.genre) {
          const mapped = mapGenre(best.genre);
          if (mapped) setGenre(mapped);
        }
        if (best.isbn) setIsbn(best.isbn);
        if (best.language) setLanguage(best.language);
      }

      // Merge cover results
      const gbC = gbCoverResult.status === 'fulfilled' ? gbCoverResult.value : [];
      const olC = olCoverResult.status === 'fulfilled' ? olCoverResult.value : [];
      const all = [...gbC, ...olC];
      const seen = new Set();
      const unique = all.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });
      setCoverOptions(unique);

      // Auto-select best cover
      const bestCover = gb?.coverUrl || ol?.coverUrl || (unique.length > 0 ? unique[0].url : '');
      if (bestCover) setCoverUrl(bestCover);

      if (best || unique.length > 0) {
        toast('Metadata encontrada!', 'success');
      } else {
        toast('No se encontraron resultados', 'info');
      }
    } catch {
      toast('Error al buscar metadata', 'error');
    } finally {
      setFetchingMeta(false);
      setSearchingCovers(false);
    }
  };

  // --- Save ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    // Never save blob: URLs
    const safeCover = coverUrl.trim().startsWith('blob:') ? '' : coverUrl.trim();

    setSaving(true);
    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim(),
        genre,
        language,
        description: description.trim(),
        coverUrl: safeCover,
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
          {/* Cover section */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Portada
            </label>
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              {/* Current cover preview */}
              <div style={{
                width: 80,
                height: 120,
                borderRadius: 4,
                overflow: 'hidden',
                flexShrink: 0,
                background: 'var(--surface)',
                border: coverUrl ? '2px solid var(--accent)' : '2px dashed var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {coverUrl && !coverUrl.startsWith('blob:') ? (
                  <img
                    src={coverUrl}
                    alt="Portada actual"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 4 }}>
                    Sin portada
                  </span>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleSearchCovers}
                  disabled={searchingCovers || (!title.trim() && !isbn.trim())}
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                >
                  {searchingCovers ? 'Buscando...' : 'Buscar portada'}
                </button>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl('')}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, color: 'var(--danger)' }}
                  >
                    Quitar portada
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                >
                  {showUrlInput ? 'Ocultar URL' : 'Pegar URL manual'}
                </button>
                {showUrlInput && (
                  <input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ fontSize: 12 }}
                  />
                )}
              </div>
            </div>

            {/* Cover search results grid */}
            {searchingCovers && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Buscando en Google Books y Open Library...
              </div>
            )}

            {coverOptions.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {coverOptions.length} portadas encontradas — hacele click para seleccionar:
                </div>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 8,
                }}>
                  {coverOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCoverUrl(opt.url);
                        toast('Portada seleccionada', 'success');
                      }}
                      style={{
                        flexShrink: 0,
                        width: 60,
                        height: 90,
                        padding: 0,
                        border: coverUrl === opt.url ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: 4,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: 'var(--surface)',
                        transition: 'border-color 0.15s',
                      }}
                      title={`${opt.label} (${opt.source})`}
                    >
                      <img
                        src={opt.url}
                        alt={opt.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
          <div style={{ marginBottom: 20 }}>
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
