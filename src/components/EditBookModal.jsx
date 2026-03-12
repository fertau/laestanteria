import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { searchCandidates, buildDiffFromCandidate } from '../lib/batchQueue';
import { searchCovers as gbCovers } from '../lib/googleBooks';
import { searchCovers as olCovers } from '../lib/openLibrary';
import { searchCovers as hcCovers } from '../lib/hardcover';
import { searchCovers as giCovers } from '../lib/googleImageSearch';
import { isValidCover } from '../lib/coverUtils';

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
 * Normalize a book title from API results:
 * - Remove common noise: "(Spanish Edition)", "[Lingua spagnola]", ISBNs, library tags
 * - Fix ALL CAPS → Title Case (but preserve short words like "de", "el", "y")
 */
function normalizeTitle(raw) {
  if (!raw) return '';
  let t = raw
    .replace(/[\[\(]?\b97[89][-\s]?\d[-\s]?\d{2}[-\s]?\d{5}[-\s]?\d[-\s]?[\dX]\b[\]\)]?/gi, '')
    .replace(/[\[\(]\s*(?:18|19|20)\d{2}\s*[\]\)]/g, '')
    .replace(/\s*[\[\(](?:calibre|z-?lib|epub|mobi|pdf|kindle|ebook|v?\d+\.\d+|www\.[^\]]+)[^\]\)]*[\]\)]/gi, '')
    .replace(/[\(\[]\s*(Spanish|English|French|Portuguese|German|Italian)\s*(Edition|Ed\.?)?\s*[\)\]]/gi, '')
    .replace(/[\(\[]\s*(Edici[oó]n\s*(en\s*)?(espa[nñ]ol|ingl[eé]s|franc[eé]s|portugu[eé]s|alem[aá]n|italiano))\s*[\)\]]/gi, '')
    .replace(/[\(\[]\s*Lingua\s+\w+\s*[\)\]]/gi, '')
    .replace(/[\[\(]\s*[\]\)]/g, '')
    .replace(/\s*:\s*$/, '')
    .trim();

  const words = t.split(/\s+/);
  const uppercaseCount = words.filter((w) => w.length > 1 && w === w.toUpperCase()).length;
  if (uppercaseCount >= 2 && uppercaseCount >= words.length * 0.6) {
    const minorWords = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'y', 'e', 'o', 'u', 'en', 'a', 'al', 'un', 'una', 'the', 'of', 'and', 'in', 'or', 'to', 'for', 'on', 'at', 'by']);
    t = words.map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && minorWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
  }

  return t.replace(/\s{2,}/g, ' ').trim();
}

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

/** Source badge color mapping */
const SOURCE_COLORS = {
  google: { color: '#4285F4', bg: 'rgba(66,133,244,0.1)' },
  hardcover: { color: '#E8590C', bg: 'rgba(232,89,12,0.1)' },
  openlibrary: { color: '#e44f26', bg: 'rgba(228,79,38,0.1)' },
};

function sourceLabel(src) {
  if (src === 'google') return 'Google';
  if (src === 'hardcover') return 'Hardcover';
  return 'OpenLib';
}

/**
 * EditBookModal — Edit all metadata fields of an existing book.
 * Single "magic wand" button searches all APIs and shows Plex-style candidates.
 */
export default function EditBookModal({ book, onClose, onSaved }) {
  const { updateBook } = useBooks();
  const { toast } = useToast();

  // Form fields — pre-filled with current book values
  const [title, setTitle] = useState(book.title || '');
  const [author, setAuthor] = useState(book.author || '');
  const [genre, setGenre] = useState(book.genre || '');
  const [language, setLanguage] = useState(book.language || 'es');
  const [description, setDescription] = useState(book.description || '');
  const [coverUrl, setCoverUrl] = useState(book.coverUrl || '');
  const [isbn, setIsbn] = useState(book.isbn || '');
  const [saving, setSaving] = useState(false);

  // Phase: 'form' | 'searching' | 'candidates'
  const [phase, setPhase] = useState('form');
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(-1);
  const [coverOptions, setCoverOptions] = useState([]);
  const [searchingGI, setSearchingGI] = useState(false);

  // Auto-search when opening a book with no cover
  useEffect(() => {
    if ((!book.coverUrl || book.coverUrl.startsWith('blob:')) && (book.title || book.isbn)) {
      const timer = setTimeout(() => handleMagicSearch(true), 300);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Single unified search: candidates + covers ---
  const handleMagicSearch = async (autoMode = false) => {
    const searchTitle = title.trim();
    const searchAuthor = author.trim();
    const searchIsbn = isbn.trim();
    if (!searchTitle && !searchIsbn) {
      if (!autoMode) toast('Ingresa un titulo o ISBN primero', 'info');
      return;
    }

    setPhase('searching');
    setCandidates([]);
    setCoverOptions([]);
    setSelectedCandidateIndex(-1);

    try {
      // Search candidates + covers in parallel
      const [candidateResult, gbC, olC, hcC] = await Promise.allSettled([
        searchCandidates(searchTitle, searchAuthor, searchIsbn),
        gbCovers(searchTitle, searchAuthor, searchIsbn, language),
        olCovers(searchTitle, searchAuthor, searchIsbn, language),
        hcCovers(searchTitle, searchAuthor, searchIsbn),
      ]);

      const cands = candidateResult.status === 'fulfilled' ? candidateResult.value : [];
      setCandidates(cands);

      // Merge covers
      const allCovers = [
        ...(gbC.status === 'fulfilled' ? gbC.value : []),
        ...(olC.status === 'fulfilled' ? olC.value : []),
        ...(hcC.status === 'fulfilled' ? hcC.value : []),
      ];
      const seen = new Set();
      const unique = allCovers.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });
      setCoverOptions(unique);

      // In auto mode: auto-apply the best candidate silently
      if (autoMode && cands.length > 0) {
        const best = cands[0];
        // Only auto-fill cover if current is empty
        if (best.coverUrl && (!coverUrl || coverUrl.startsWith('blob:'))) {
          // Validate before setting
          const coverCandidates = [best.coverUrl, ...unique.map((c) => c.url)].filter(Boolean);
          for (const url of coverCandidates) {
            if (await isValidCover(url)) {
              setCoverUrl(url);
              break;
            }
          }
        }
        setPhase('form');
        return;
      }

      if (cands.length > 0) {
        setSelectedCandidateIndex(0);
        setPhase('candidates');
      } else if (unique.length > 0) {
        // No metadata candidates but found covers
        setPhase('candidates');
        toast('No se encontraron candidatos, pero hay portadas disponibles', 'info');
      } else {
        setPhase('form');
        toast('No se encontraron resultados', 'info');
      }
    } catch {
      setPhase('form');
      toast('Error al buscar', 'error');
    }
  };

  // --- Apply selected candidate to form ---
  const applyCandidate = () => {
    if (selectedCandidateIndex < 0 || selectedCandidateIndex >= candidates.length) {
      setPhase('form');
      return;
    }
    const cand = candidates[selectedCandidateIndex];

    // Apply metadata
    if (cand.title) setTitle(normalizeTitle(cand.title));
    if (cand.author) setAuthor(normalizeTitle(cand.author));
    if (cand.description) setDescription(cand.description);
    if (cand.genre) {
      const mapped = mapGenre(cand.genre);
      if (mapped) setGenre(mapped);
    }
    if (cand.isbn) setIsbn(cand.isbn);
    if (cand.language) setLanguage(cand.language);
    if (cand.coverUrl) setCoverUrl(cand.coverUrl);

    toast('Metadata aplicada — revisa y guarda', 'success');
    setPhase('form');
  };

  // --- Google Image Search (secondary, appends covers) ---
  const handleGoogleImageSearch = async () => {
    if (!title.trim() && !isbn.trim()) return;
    setSearchingGI(true);
    try {
      const results = await giCovers(title, author, isbn, language);
      if (results.length === 0) {
        toast('Google Images no encontro portadas', 'info');
        return;
      }
      setCoverOptions((prev) => {
        const seen = new Set(prev.map((c) => c.url));
        const newCovers = results.filter((c) => !seen.has(c.url));
        if (newCovers.length === 0) {
          toast('No hay portadas nuevas', 'info');
          return prev;
        }
        toast(`${newCovers.length} portadas nuevas`, 'success');
        return [...prev, ...newCovers];
      });
    } catch {
      toast('Error al buscar en Google Images', 'error');
    } finally {
      setSearchingGI(false);
    }
  };

  // --- Save ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    setSaving(true);
    try {
      const safeCover = coverUrl.trim().startsWith('blob:') ? '' : coverUrl.trim();
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

  // --- Render ---
  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (phase === 'candidates') setPhase('form');
          else onClose();
        }
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        padding: 28,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
            Editar libro
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>X</button>
        </div>

        {/* Searching overlay */}
        {phase === 'searching' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 16, padding: '12px 14px',
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            fontSize: 13, color: 'var(--text-muted)',
          }}>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Buscando en Google Books, Open Library y Hardcover...
          </div>
        )}

        {/* ====== CANDIDATES PHASE ====== */}
        {phase === 'candidates' && (
          <div style={{ marginBottom: 20 }}>
            {/* Candidate strip */}
            {candidates.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {candidates.length} candidatos — selecciona el correcto:
                </div>
                <div style={{
                  display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6,
                }}>
                  {candidates.map((cand, ci) => (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => setSelectedCandidateIndex(ci)}
                      style={{
                        flexShrink: 0, width: 120, padding: 8,
                        border: selectedCandidateIndex === ci
                          ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        background: selectedCandidateIndex === ci
                          ? 'rgba(193,123,63,0.08)' : 'var(--bg)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: '100%', height: 80, borderRadius: 4,
                        overflow: 'hidden', background: 'var(--surface)', marginBottom: 6,
                      }}>
                        {cand.coverUrl ? (
                          <img
                            src={cand.coverUrl} alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                            loading="lazy"
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: 'var(--text-dim)',
                          }}>sin portada</div>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--text)',
                      }}>
                        {cand.title || '(sin titulo)'}
                      </div>
                      <div style={{
                        fontSize: 10, color: 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {cand.author || '(sin autor)'}
                      </div>
                      <span style={{
                        display: 'inline-block', fontSize: 9, fontWeight: 700,
                        color: (SOURCE_COLORS[cand.source] || SOURCE_COLORS.openlibrary).color,
                        background: (SOURCE_COLORS[cand.source] || SOURCE_COLORS.openlibrary).bg,
                        padding: '1px 5px', borderRadius: 3, marginTop: 4,
                      }}>
                        {sourceLabel(cand.source)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cover gallery */}
            {coverOptions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {coverOptions.length} portadas — click para seleccionar:
                  </span>
                  <button
                    type="button"
                    onClick={handleGoogleImageSearch}
                    disabled={searchingGI}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                  >
                    {searchingGI ? '...' : '✨ Google Images'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                  {coverOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCoverUrl(opt.url);
                        toast('Portada seleccionada', 'success');
                      }}
                      style={{
                        flexShrink: 0, width: 60, height: 90, padding: 0,
                        border: coverUrl === opt.url ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                        background: 'var(--surface)', transition: 'border-color 0.15s',
                      }}
                      title={`${opt.label} (${opt.source})`}
                    >
                      <img
                        src={opt.url} alt={opt.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Candidate action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={applyCandidate}
                className="btn btn-primary"
                disabled={selectedCandidateIndex < 0}
                style={{ flex: 1 }}
              >
                Aplicar y editar
              </button>
              <button
                type="button"
                onClick={() => setPhase('form')}
                className="btn btn-secondary"
              >
                Cancelar busqueda
              </button>
            </div>
          </div>
        )}

        {/* ====== FORM PHASE ====== */}
        <form onSubmit={handleSubmit}>
          {/* Cover + Magic Wand row */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Cover preview */}
              <div style={{
                width: 80, height: 120, borderRadius: 4, overflow: 'hidden', flexShrink: 0,
                background: 'var(--surface)',
                border: coverUrl ? '2px solid var(--accent)' : '2px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {coverUrl && !coverUrl.startsWith('blob:') ? (
                  <img
                    src={coverUrl} alt="Portada"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 4 }}>
                    Sin portada
                  </span>
                )}
              </div>

              {/* Magic wand + cover URL */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handleMagicSearch(false)}
                  disabled={phase === 'searching' || (!title.trim() && !isbn.trim())}
                  className="btn btn-primary"
                  style={{ fontSize: 13, width: '100%' }}
                >
                  {phase === 'searching' ? 'Buscando...' : '✨ Buscar libro'}
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
                <input
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="Pegar URL de portada..."
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>

            {/* Cover options (persist from candidates phase) */}
            {phase === 'form' && coverOptions.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {coverOptions.length} portadas disponibles:
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                  {coverOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCoverUrl(opt.url);
                        toast('Portada seleccionada', 'success');
                      }}
                      style={{
                        flexShrink: 0, width: 60, height: 90, padding: 0,
                        border: coverUrl === opt.url ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                        background: 'var(--surface)', transition: 'border-color 0.15s',
                      }}
                      title={`${opt.label} (${opt.source})`}
                    >
                      <img
                        src={opt.url} alt={opt.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              Titulo *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: '100%' }}
            />
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
              <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%' }}>
                <option value="">Sin genero</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Idioma *
              </label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} required style={{ width: '100%' }}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* ISBN */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              ISBN
            </label>
            <input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="978-..."
              style={{ width: '100%' }}
            />
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
              disabled={saving || !title.trim() || !author.trim() || phase === 'searching'}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
