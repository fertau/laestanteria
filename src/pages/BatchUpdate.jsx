import { useState, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { buildBatchItem, processBatchItem, applyBatchItem } from '../lib/batchQueue';

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

  // Phase management
  const [phase, setPhase] = useState('select');
  const [queue, setQueue] = useState([]);
  const cancelledRef = useRef(false);

  // Select phase state
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Review phase state
  const [expandedIds, setExpandedIds] = useState(new Set());

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
        if (item.id !== bookId || !item.diff?.coverUrl) return item;
        return {
          ...item,
          diff: { ...item.diff, coverUrl: { ...item.diff.coverUrl, new: url, accepted: true } },
        };
      }),
    );
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
                  {item.status === 'ready' && `${Object.keys(item.diff || {}).length} cambios`}
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
              const isExpanded = expandedIds.has(item.id);
              const acceptedCount = diffEntries.filter(([, d]) => d.accepted).length;

              return (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    opacity: hasDiff ? 1 : 0.5,
                  }}
                >
                  {/* Book header row */}
                  <button
                    onClick={() => hasDiff && toggleExpanded(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      width: '100%',
                      background: isExpanded ? 'var(--surface)' : 'transparent',
                      border: 'none',
                      cursor: hasDiff ? 'pointer' : 'default',
                      color: 'var(--text)',
                      textAlign: 'left',
                    }}
                  >
                    {hasDiff && (
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
                        : item.status === 'error'
                          ? 'Error'
                          : 'Sin cambios'}
                    </span>
                  </button>

                  {/* Expanded diff */}
                  {isExpanded && hasDiff && (
                    <div style={{ padding: '0 12px 12px', background: 'var(--surface)' }}>
                      {diffEntries.map(([field, change]) => (
                        <div key={field} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={change.accepted}
                              onChange={() => toggleDiffField(item.id, field)}
                              style={{ marginTop: 2 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
                                {FIELD_LABELS[field] || field}
                              </div>
                              {field === 'coverUrl' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {/* Old cover */}
                                  <div style={{
                                    width: 40,
                                    height: 60,
                                    borderRadius: 3,
                                    background: 'var(--bg)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    {change.old && !change.old.startsWith('blob:') ? (
                                      <img
                                        src={change.old}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>sin</span>
                                    )}
                                  </div>
                                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
                                  {/* New cover */}
                                  <div style={{
                                    width: 40,
                                    height: 60,
                                    borderRadius: 3,
                                    border: '2px solid var(--accent)',
                                    overflow: 'hidden',
                                  }}>
                                    <img
                                      src={change.new}
                                      alt=""
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 12 }}>
                                  {change.old ? (
                                    <span>
                                      <span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                                        {change.old}
                                      </span>
                                      {' → '}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-dim)' }}>(vacio) → </span>
                                  )}
                                  <span style={{ color: 'var(--success)' }}>{change.new}</span>
                                </div>
                              )}
                            </div>
                          </label>

                          {/* Cover options gallery */}
                          {field === 'coverUrl' && item.coverOptions?.length > 1 && (
                            <div style={{ marginTop: 8, marginLeft: 28 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                                Otras portadas disponibles:
                              </div>
                              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                                {item.coverOptions.map((opt, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => selectCover(item.id, opt.url)}
                                    style={{
                                      flexShrink: 0,
                                      width: 40,
                                      height: 60,
                                      padding: 0,
                                      border: change.new === opt.url
                                        ? '2px solid var(--accent)'
                                        : '2px solid transparent',
                                      borderRadius: 3,
                                      overflow: 'hidden',
                                      cursor: 'pointer',
                                      background: 'var(--bg)',
                                    }}
                                    title={`${opt.label} (${opt.source})`}
                                  >
                                    <img
                                      src={opt.url}
                                      alt=""
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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
