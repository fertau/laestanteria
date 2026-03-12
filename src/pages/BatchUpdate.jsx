import { useState, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { buildBatchItem, processBatchItem, applyBatchItem, reSearchBatchItem, buildDiffFromCandidate } from '../lib/batchQueue';
import { searchCovers as giCovers } from '../lib/googleImageSearch';
import EditBookModal from '../components/EditBookModal';

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

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'noCover', label: 'Sin portada' },
  { value: 'noIsbn', label: 'Sin ISBN' },
  { value: 'noGenre', label: 'Sin genero' },
  { value: 'noDesc', label: 'Sin descripcion' },
];

const FIELD_LABELS = {
  title: 'Titulo',
  author: 'Autor',
  genre: 'Genero',
  language: 'Idioma',
  description: 'Descripcion',
  isbn: 'ISBN',
  coverUrl: 'Portada',
};

export default function BatchUpdate() {
  const { user } = useAuth();
  const { books, updateBook } = useBooks();
  const { toast } = useToast();
  const location = useLocation();

  // Phase management
  const [phase, setPhase] = useState('select');
  const [queue, setQueue] = useState([]);
  const cancelledRef = useRef(false);

  // Select phase state
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => {
    const pre = location.state?.preSelectedIds;
    return pre ? new Set(pre) : new Set();
  });

  // Review phase state
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [giSearchingId, setGiSearchingId] = useState(null);

  // Re-search state
  const [reSearchId, setReSearchId] = useState(null);
  const [reSearchTitle, setReSearchTitle] = useState('');
  const [reSearchAuthor, setReSearchAuthor] = useState('');
  const [reSearchIsbn, setReSearchIsbn] = useState('');
  const [reSearching, setReSearching] = useState(false);

  // EditBookModal state — opened from review phase
  const [editingBook, setEditingBook] = useState(null);

  // Stats for done phase
  const [stats, setStats] = useState({ updated: 0, unchanged: 0, errors: 0 });

  // Only user's own books
  const myBooks = useMemo(
    () => books.filter((b) => b.uploadedBy?.uid === user?.uid),
    [books, user],
  );

  // Filtered + searched books
  const filteredBooks = useMemo(() => {
    let list = myBooks;

    // Apply filter
    if (filter === 'noCover') list = list.filter((b) => !b.coverUrl || b.coverUrl.startsWith('blob:'));
    else if (filter === 'noIsbn') list = list.filter((b) => !b.isbn);
    else if (filter === 'noGenre') list = list.filter((b) => !b.genre);
    else if (filter === 'noDesc') list = list.filter((b) => !b.description);

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          (b.title || '').toLowerCase().includes(q) ||
          (b.author || '').toLowerCase().includes(q),
      );
    }

    return list;
  }, [myBooks, filter, search]);

  // --- Selection helpers ---
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredBooks.map((b) => b.id)));
  }, [filteredBooks]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = filteredBooks.length > 0 && filteredBooks.every((b) => selectedIds.has(b.id));

  // --- Queue update helper ---
  const updateQueueItem = useCallback((id, update) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }, []);

  // --- Start processing ---
  const startProcessing = async () => {
    if (selectedIds.size === 0) return;

    // Build queue from selected books
    const selected = myBooks.filter((b) => selectedIds.has(b.id));
    const items = selected.map(buildBatchItem);
    setQueue(items);
    setPhase('processing');
    cancelledRef.current = false;

    // Process sequentially
    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) break;

      const item = items[i];
      await processBatchItem(item, (update) => {
        // Update both local item and queue state
        Object.assign(item, update);
        updateQueueItem(item.id, update);
      });

      // Rate limit: 500ms between books
      if (i < items.length - 1 && !cancelledRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setPhase('review');
  };

  const cancelProcessing = () => {
    cancelledRef.current = true;
    // Still go to review with whatever we processed
    setTimeout(() => setPhase('review'), 300);
  };

  // --- Apply changes ---
  const startApplying = async () => {
    setPhase('saving');
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const item of queue) {
      const acceptedCount = Object.values(item.diff || {}).filter((d) => d.accepted).length;
      if (acceptedCount === 0 || item.status === 'unchanged') {
        unchanged++;
        continue;
      }

      const success = await applyBatchItem(item, updateBook, (update) => {
        updateQueueItem(item.id, update);
      });

      if (success) updated++;
      else errors++;
    }

    setStats({ updated, unchanged, errors });
    setPhase('done');
    toast(`${updated} libros actualizados`, 'success');
  };

  // --- Diff helpers ---
  const toggleDiffField = (bookId, field) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== bookId || !item.diff?.[field]) return item;
        return {
          ...item,
          diff: {
            ...item.diff,
            [field]: { ...item.diff[field], accepted: !item.diff[field].accepted },
          },
        };
      }),
    );
  };

  const acceptAll = () => {
    setQueue((prev) =>
      prev.map((item) => {
        if (!item.diff) return item;
        const newDiff = {};
        for (const [k, v] of Object.entries(item.diff)) {
          newDiff[k] = { ...v, accepted: true };
        }
        return { ...item, diff: newDiff };
      }),
    );
  };

  const rejectAll = () => {
    setQueue((prev) =>
      prev.map((item) => {
        if (!item.diff) return item;
        const newDiff = {};
        for (const [k, v] of Object.entries(item.diff)) {
          newDiff[k] = { ...v, accepted: false };
        }
        return { ...item, diff: newDiff };
      }),
    );
  };

  const selectCover = (bookId, url) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== bookId) return item;
        const oldCover = (item.book.coverUrl || '').trim();
        return {
          ...item,
          diff: {
            ...item.diff,
            coverUrl: { old: item.diff?.coverUrl?.old ?? oldCover, new: url, accepted: true },
          },
        };
      }),
    );
  };

  const editDiffField = useCallback((bookId, field, newValue) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== bookId) return item;
        if (item.diff?.[field]) {
          return {
            ...item,
            diff: { ...item.diff, [field]: { ...item.diff[field], new: newValue, accepted: true } },
          };
        }
        // Create diff entry if it didn't exist
        const oldVal = (item.book[field] || '').toString().trim();
        if (newValue.trim() && newValue.trim() !== oldVal) {
          return {
            ...item,
            diff: { ...item.diff, [field]: { old: oldVal, new: newValue, accepted: true } },
          };
        }
        return item;
      }),
    );
  }, []);

  const handleGoogleImageSearch = async (bookId) => {
    const item = queue.find((q) => q.id === bookId);
    if (!item) return;
    const t = item.diff?.title?.new || item.book.title || '';
    const a = item.diff?.author?.new || item.book.author || '';
    const i = item.diff?.isbn?.new || item.book.isbn || '';
    const lang = item.diff?.language?.new || item.book.language || 'es';
    if (!t.trim() && !i.trim()) { toast('Sin titulo o ISBN para buscar', 'info'); return; }
    setGiSearchingId(bookId);
    try {
      const results = await giCovers(t, a, i, lang);
      if (results.length === 0) { toast('Google Images no encontro portadas', 'info'); return; }
      setQueue((prev) =>
        prev.map((qi) => {
          if (qi.id !== bookId) return qi;
          const existing = new Set((qi.coverOptions || []).map((c) => c.url));
          const newCovers = results.filter((c) => !existing.has(c.url));
          if (newCovers.length === 0) { toast('No hay portadas nuevas', 'info'); return qi; }
          toast(`${newCovers.length} portadas de Google Images`, 'success');
          return { ...qi, coverOptions: [...(qi.coverOptions || []), ...newCovers] };
        }),
      );
    } catch { toast('Error al buscar en Google Images', 'error'); }
    finally { setGiSearchingId(null); }
  };

  // --- Candidate selection ---
  const selectCandidate = useCallback((bookId, candidateIndex) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== bookId) return item;
        const candidate = item.candidates?.[candidateIndex];
        if (!candidate) return item;
        const newDiff = buildDiffFromCandidate(item.book, candidate, item.fillEmptyOnly !== false);
        return { ...item, selectedCandidateIndex: candidateIndex, diff: newDiff };
      }),
    );
  }, []);

  const toggleFillMode = useCallback((bookId) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== bookId) return item;
        const newFillEmpty = !item.fillEmptyOnly;
        let newDiff = item.diff;
        if (item.selectedCandidateIndex >= 0 && item.candidates?.[item.selectedCandidateIndex]) {
          newDiff = buildDiffFromCandidate(item.book, item.candidates[item.selectedCandidateIndex], newFillEmpty);
        }
        return { ...item, fillEmptyOnly: newFillEmpty, diff: newDiff };
      }),
    );
  }, []);

  const handleReSearch = async (bookId) => {
    setReSearching(true);
    const customSearch = {
      title: reSearchTitle.trim(),
      author: reSearchAuthor.trim(),
      isbn: reSearchIsbn.trim(),
    };
    const item = queue.find((q) => q.id === bookId);
    if (item) {
      await reSearchBatchItem(item, customSearch, (update) => updateQueueItem(bookId, update));
    }
    setReSearching(false);
    setReSearchId(null);
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Computed review stats
  const totalAccepted = queue.filter(
    (item) => item.diff && Object.values(item.diff).some((d) => d.accepted),
  ).length;

  const totalWithChanges = queue.filter(
    (item) => item.diff && Object.keys(item.diff).length > 0,
  ).length;

  // --- Processing progress ---
  const processed = queue.filter(
    (item) => item.status !== 'pending' && item.status !== 'searching' && item.status !== 'covers',
  ).length;
  const currentItem = queue.find(
    (item) => item.status === 'searching' || item.status === 'covers',
  );
  const progressPct = queue.length > 0 ? Math.round((processed / queue.length) * 100) : 0;

  // ======================== RENDER ========================

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link
          to="/catalog"
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}
        >
          ← Catalogo
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0 }}>
          Actualizar metadata en lote
        </h1>
      </div>

      {/* Phase: SELECT */}
      {phase === 'select' && (
        <>
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar titulo, autor..."
            style={{ width: '100%', marginBottom: 12 }}
          />

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={filter === f.value ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                {f.value !== 'all' && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    ({myBooks.filter((b) => {
                      if (f.value === 'noCover') return !b.coverUrl || b.coverUrl.startsWith('blob:');
                      if (f.value === 'noIsbn') return !b.isbn;
                      if (f.value === 'noGenre') return !b.genre;
                      if (f.value === 'noDesc') return !b.description;
                      return false;
                    }).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Select all + action */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            padding: '8px 0',
            borderBottom: '1px solid var(--border)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={allSelected ? deselectAll : selectAll}
              />
              Seleccionar todos ({filteredBooks.length})
            </label>
            <button
              className="btn btn-primary"
              disabled={selectedIds.size === 0}
              onClick={startProcessing}
              style={{ fontSize: 13 }}
            >
              Actualizar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          </div>

          {/* Book list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredBooks.map((book) => (
              <label
                key={book.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  background: selectedIds.has(book.id) ? 'var(--surface)' : 'transparent',
                  transition: 'background var(--transition)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(book.id)}
                  onChange={() => toggleSelect(book.id)}
                  style={{ flexShrink: 0 }}
                />
                {/* Mini cover */}
                <div style={{
                  width: 32,
                  height: 48,
                  borderRadius: 3,
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'var(--surface)',
                }}>
                  {book.coverUrl && !book.coverUrl.startsWith('blob:') ? (
                    <img
                      src={book.coverUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                      loading="lazy"
                    />
                  ) : null}
                </div>
                {/* Title + author */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {book.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {book.author}
                  </div>
                </div>
                {/* Status badges */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {(!book.coverUrl || book.coverUrl.startsWith('blob:')) && (
                    <span style={warningBadge} title="Sin portada">img</span>
                  )}
                  {!book.isbn && (
                    <span style={warningBadge} title="Sin ISBN">isbn</span>
                  )}
                  {!book.genre && (
                    <span style={warningBadge} title="Sin genero">gen</span>
                  )}
                </div>
              </label>
            ))}
            {filteredBooks.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 14 }}>
                No se encontraron libros
              </div>
            )}
          </div>
        </>
      )}

      {/* Phase: PROCESSING */}
      {phase === 'processing' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Buscando metadata... {processed} de {queue.length}
              </span>
              <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>
                {progressPct}%
              </span>
            </div>
            {/* Progress bar */}
            <div style={{
              height: 6,
              background: 'var(--surface)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Queue list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius)',
                  background: item.status === 'searching' || item.status === 'covers' ? 'var(--surface)' : 'transparent',
                }}
              >
                {/* Status icon */}
                <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {item.status === 'pending' && <span style={{ color: 'var(--text-dim)' }}>·</span>}
                  {(item.status === 'searching' || item.status === 'covers') && (
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  )}
                  {item.status === 'ready' && <span style={{ color: 'var(--success)' }}>✓</span>}
                  {item.status === 'unchanged' && <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  {item.status === 'error' && <span style={{ color: 'var(--danger)' }}>✗</span>}
                </span>
                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}>
                    {item.book.title}
                  </span>
                </div>
                {/* Result summary */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {item.status === 'searching' && 'Buscando...'}
                  {item.status === 'covers' && 'Portadas...'}
                  {item.status === 'ready' && `${item.candidates?.length || 0} candidatos, ${Object.keys(item.diff || {}).length} cambios`}
                  {item.status === 'unchanged' && 'Sin cambios'}
                  {item.status === 'error' && (item.error || 'Error')}
                </span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={cancelProcessing} style={{ fontSize: 13 }}>
              Cancelar busqueda
            </button>
          </div>
        </>
      )}

      {/* Phase: REVIEW */}
      {phase === 'review' && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {totalWithChanges} libros con cambios encontrados
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={acceptAll}>
                Aceptar todos
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={rejectAll}>
                Rechazar todos
              </button>
            </div>
          </div>

          {/* Review list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {queue.map((item) => {
              const diffEntries = Object.entries(item.diff || {});
              const hasDiff = diffEntries.length > 0;
              const hasCandidates = (item.candidates?.length || 0) > 0;
              const isExpandable = hasDiff || hasCandidates;
              const isExpanded = expandedIds.has(item.id);
              const acceptedCount = diffEntries.filter(([, d]) => d.accepted).length;

              return (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    opacity: isExpandable ? 1 : 0.5,
                  }}
                >
                  {/* Book header row */}
                  <button
                    onClick={() => isExpandable && toggleExpanded(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      width: '100%',
                      background: isExpanded ? 'var(--surface)' : 'transparent',
                      border: 'none',
                      cursor: isExpandable ? 'pointer' : 'default',
                      color: 'var(--text)',
                      textAlign: 'left',
                    }}
                  >
                    {isExpandable && (
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}>
                        {item.book.title}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.book.author}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: hasDiff ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0 }}>
                      {hasDiff
                        ? `${acceptedCount}/${diffEntries.length} campos`
                        : hasCandidates
                          ? `${item.candidates.length} candidatos`
                          : item.status === 'error'
                            ? 'Error'
                            : 'Sin resultados'}
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ background: 'var(--surface)' }}>
                      {/* Candidate cards — horizontal scroll */}
                      {hasCandidates && (
                        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {item.candidates.length} candidatos encontrados:
                          </div>
                          <div style={{
                            display: 'flex',
                            gap: 8,
                            overflowX: 'auto',
                            paddingBottom: 6,
                          }}>
                            {item.candidates.map((cand, ci) => (
                              <button
                                key={ci}
                                type="button"
                                onClick={() => selectCandidate(item.id, ci)}
                                style={{
                                  flexShrink: 0,
                                  width: 120,
                                  padding: 8,
                                  border: item.selectedCandidateIndex === ci
                                    ? '2px solid var(--accent)'
                                    : '1px solid var(--border)',
                                  borderRadius: 'var(--radius)',
                                  background: item.selectedCandidateIndex === ci
                                    ? 'rgba(193,123,63,0.08)'
                                    : 'var(--bg)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <div style={{
                                  width: '100%',
                                  height: 80,
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                  background: 'var(--surface)',
                                  marginBottom: 6,
                                }}>
                                  {cand.coverUrl ? (
                                    <img
                                      src={cand.coverUrl}
                                      alt=""
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
                                  color: cand.source === 'google' ? '#4285F4'
                                    : cand.source === 'hardcover' ? '#E8590C'
                                    : '#e44f26',
                                  background: cand.source === 'google' ? 'rgba(66,133,244,0.1)'
                                    : cand.source === 'hardcover' ? 'rgba(232,89,12,0.1)'
                                    : 'rgba(228,79,38,0.1)',
                                  padding: '1px 5px', borderRadius: 3, marginTop: 4,
                                }}>
                                  {cand.source === 'google' ? 'Google'
                                    : cand.source === 'hardcover' ? 'Hardcover'
                                    : 'OpenLib'}
                                </span>
                              </button>
                            ))}

                            {/* "Re-search" action card */}
                            <button
                              type="button"
                              onClick={() => {
                                setReSearchId(item.id);
                                setReSearchTitle(item.book.title || '');
                                setReSearchAuthor(item.book.author || '');
                                setReSearchIsbn(item.book.isbn || '');
                              }}
                              style={{
                                flexShrink: 0, width: 120, padding: 8,
                                border: '1px dashed var(--border)',
                                borderRadius: 'var(--radius)',
                                background: 'transparent', cursor: 'pointer',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: 4, color: 'var(--text-muted)',
                              }}
                            >
                              <span style={{ fontSize: 20 }}>&#x1f50d;</span>
                              <span style={{ fontSize: 11 }}>Otra busqueda</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* No candidates — open full edit modal */}
                      {!hasCandidates && item.status !== 'error' && (
                        <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>
                            No se encontraron candidatos
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12 }}
                            onClick={() => setEditingBook(item.book)}
                          >
                            ✨ Editar y buscar
                          </button>
                        </div>
                      )}

                      {/* "Edit with magic wand" button — always visible */}
                      {hasCandidates && (
                        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setEditingBook(item.book)}
                            style={{
                              fontSize: 11, padding: '4px 10px',
                              border: '1px dashed var(--accent)',
                              borderRadius: 'var(--radius)',
                              background: 'transparent',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                            }}
                          >
                            ✨ Editar con varita
                          </button>
                        </div>
                      )}

                      {/* Re-search form */}
                      {reSearchId === item.id && (
                        <div style={{
                          padding: '10px 12px', background: 'var(--bg)',
                          borderTop: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                            Busqueda personalizada:
                          </div>
                          <input
                            value={reSearchTitle}
                            onChange={(e) => setReSearchTitle(e.target.value)}
                            placeholder="Titulo"
                            style={{ fontSize: 12, padding: '6px 10px' }}
                          />
                          <input
                            value={reSearchAuthor}
                            onChange={(e) => setReSearchAuthor(e.target.value)}
                            placeholder="Autor"
                            style={{ fontSize: 12, padding: '6px 10px' }}
                          />
                          <input
                            value={reSearchIsbn}
                            onChange={(e) => setReSearchIsbn(e.target.value)}
                            placeholder="ISBN"
                            style={{ fontSize: 12, padding: '6px 10px' }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontSize: 12, flex: 1 }}
                              disabled={reSearching || (!reSearchTitle.trim() && !reSearchIsbn.trim())}
                              onClick={() => handleReSearch(item.id)}
                            >
                              {reSearching ? 'Buscando...' : 'Buscar'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ fontSize: 12 }}
                              onClick={() => setReSearchId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Fill mode toggle */}
                      {item.selectedCandidateIndex >= 0 && (
                        <div style={{
                          padding: '6px 12px',
                          borderTop: '1px solid var(--border)',
                        }}>
                          <label style={{
                            fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            <input
                              type="checkbox"
                              checked={!item.fillEmptyOnly}
                              onChange={() => toggleFillMode(item.id)}
                            />
                            Actualizar todos los campos (no solo vacios)
                          </label>
                        </div>
                      )}

                      {/* Cover section — always visible when expanded */}
                      {isExpanded && (
                        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Portada</div>
                            <button
                              type="button"
                              onClick={() => handleGoogleImageSearch(item.id)}
                              disabled={giSearchingId === item.id}
                              className="btn btn-secondary"
                              style={{ fontSize: 14, padding: '2px 8px', marginLeft: 'auto' }}
                              title="Buscar portadas en Google Images"
                            >
                              {giSearchingId === item.id ? '...' : '✨'}
                            </button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 40, height: 60, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {item.book.coverUrl && !item.book.coverUrl.startsWith('blob:') ? (
                                <img src={item.book.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>sin</span>
                              )}
                            </div>
                            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
                            <div style={{ width: 40, height: 60, borderRadius: 3, border: item.diff?.coverUrl?.new ? '2px solid var(--accent)' : '2px dashed var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {item.diff?.coverUrl?.new ? (
                                <img src={item.diff.coverUrl.new} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>sin</span>
                              )}
                            </div>
                            {item.diff?.coverUrl && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}>
                                <input type="checkbox" checked={item.diff.coverUrl.accepted} onChange={() => toggleDiffField(item.id, 'coverUrl')} />
                                Aceptar
                              </label>
                            )}
                          </div>
                          {(item.coverOptions?.length || 0) > 0 && (
                            <>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                                {item.coverOptions.length} portadas disponibles:
                              </div>
                              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                                {item.coverOptions.map((opt, oi) => (
                                  <button key={oi} type="button" onClick={() => selectCover(item.id, opt.url)} style={{
                                    flexShrink: 0, width: 40, height: 60, padding: 0,
                                    border: item.diff?.coverUrl?.new === opt.url ? '2px solid var(--accent)' : '2px solid transparent',
                                    borderRadius: 3, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg)',
                                  }} title={`${opt.label} (${opt.source})`}>
                                    <img src={opt.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                          <input
                            value={item.diff?.coverUrl?.new || ''}
                            onChange={(e) => selectCover(item.id, e.target.value)}
                            placeholder="Pegar URL de portada..."
                            style={{ fontSize: 11, marginTop: 6, width: '100%', maxWidth: 320 }}
                          />
                        </div>
                      )}

                      {/* Field diffs (editable, excluding coverUrl) */}
                      {hasDiff && (
                        <div style={{ padding: '0 12px 12px' }}>
                          {diffEntries.filter(([field]) => field !== 'coverUrl').map(([field, change]) => (
                            <div key={field} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={change.accepted}
                                  onChange={() => toggleDiffField(item.id, field)}
                                  style={{ marginTop: 8, flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
                                    {FIELD_LABELS[field] || field}
                                  </div>
                                  {change.old ? (
                                    <div style={{ fontSize: 11, color: 'var(--text-dim)', textDecoration: 'line-through', marginBottom: 4 }}>{change.old}</div>
                                  ) : (
                                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>(vacio)</div>
                                  )}
                                  {field === 'genre' ? (
                                    <select value={change.new} onChange={(e) => editDiffField(item.id, field, e.target.value)} style={{ fontSize: 12, width: '100%' }}>
                                      <option value="">Sin genero</option>
                                      {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                  ) : field === 'language' ? (
                                    <select value={change.new} onChange={(e) => editDiffField(item.id, field, e.target.value)} style={{ fontSize: 12, width: '100%' }}>
                                      {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                                    </select>
                                  ) : field === 'description' ? (
                                    <textarea value={change.new} onChange={(e) => editDiffField(item.id, field, e.target.value)} rows={2} style={{ fontSize: 12, width: '100%', resize: 'vertical' }} />
                                  ) : (
                                    <input value={change.new} onChange={(e) => editDiffField(item.id, field, e.target.value)} style={{ fontSize: 12, width: '100%' }} />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom action bar */}
          <div style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--bg)',
            borderTop: '1px solid var(--border)',
            padding: '12px 0',
            marginTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <button
              className="btn btn-ghost"
              onClick={() => { setPhase('select'); setQueue([]); }}
              style={{ fontSize: 13 }}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              disabled={totalAccepted === 0}
              onClick={startApplying}
              style={{ fontSize: 13 }}
            >
              Aplicar {totalAccepted} {totalAccepted === 1 ? 'libro' : 'libros'}
            </button>
          </div>
        </>
      )}

      {/* Phase: SAVING */}
      {phase === 'saving' && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Aplicando cambios...</div>
        </div>
      )}

      {/* Phase: DONE */}
      {phase === 'done' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 24 }}>
            Actualizacion completa
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 300,
            margin: '0 auto 32px',
          }}>
            {stats.updated > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--success)' }}>Actualizados</span>
                <span style={{ fontWeight: 600 }}>{stats.updated}</span>
              </div>
            )}
            {stats.unchanged > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-dim)' }}>Sin cambios</span>
                <span>{stats.unchanged}</span>
              </div>
            )}
            {stats.errors > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--danger)' }}>Errores</span>
                <span>{stats.errors}</span>
              </div>
            )}
          </div>

          <Link to="/catalog" className="btn btn-primary" style={{ fontSize: 13 }}>
            Volver al catalogo
          </Link>
        </div>
      )}
      {/* EditBookModal — opened from review phase */}
      {editingBook && (
        <EditBookModal
          book={editingBook}
          onClose={() => setEditingBook(null)}
          onSaved={() => setEditingBook(null)}
        />
      )}
    </div>
  );
}

const warningBadge = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--accent)',
  background: 'rgba(193,123,63,0.15)',
  padding: '2px 5px',
  borderRadius: 3,
  textTransform: 'uppercase',
};
