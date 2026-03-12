import { useState, useRef, useCallback, useEffect } from 'react';
import { useBooks } from '../hooks/useBooks';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { detectCalibreStructure } from '../lib/calibreParser';
import { buildQueue, processQueueItem } from '../lib/importQueue';
import HelpTip from './HelpTip';

/**
 * ImportModal — Bulk import with 4 phases:
 *   1. Select: choose files or Calibre folder
 *   2. Review: preview queue, remove items
 *   3. Processing: sequential upload with progress
 *   4. Done: summary of results
 *
 * EPUBs are saved locally (OPFS/IndexedDB) and metadata to Firestore.
 */
export default function ImportModal({ onClose }) {
  const { books } = useBooks();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState('select'); // select | review | processing | done
  const [queue, setQueue] = useState([]);
  const [mode, setMode] = useState(null); // 'files' | 'calibre' | 'mixed'
  const [currentIndex, setCurrentIndex] = useState(-1);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const cancelledRef = useRef(false);
  const coverUrlsRef = useRef([]); // track Object URLs for cleanup

  // Manual identification state
  const [identificationPromise, setIdentificationPromise] = useState(null);
  const [idTitle, setIdTitle] = useState('');
  const [idAuthor, setIdAuthor] = useState('');
  const [idIsbn, setIdIsbn] = useState('');

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of coverUrlsRef.current) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
    };
  }, []);

  // --- File selection handlers ---

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    const epubs = files.filter((f) => f.name.toLowerCase().endsWith('.epub'));

    if (epubs.length === 0) {
      toast('No se encontraron archivos EPUB', 'info');
      return;
    }

    const items = buildQueue(epubs, [], 'plain');
    setQueue(items);
    setMode('files');
    setPhase('review');
  };

  const handleFolderSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const { isCalibre, books: calibreBooks, looseEpubs } = detectCalibreStructure(files);

    if (calibreBooks.length === 0 && looseEpubs.length === 0) {
      // Last resort: find any epub in the whole file list
      const anyEpubs = files.filter((f) => f.name.toLowerCase().endsWith('.epub'));
      if (anyEpubs.length === 0) {
        toast('No se encontraron archivos EPUB en la carpeta', 'info');
        return;
      }
      const items = buildQueue(anyEpubs, [], 'plain');
      setQueue(items);
      setMode('files');
      setPhase('review');
      return;
    }

    // Build combined queue
    const calibreItems = isCalibre ? buildQueue([], calibreBooks, 'calibre') : [];
    const plainItems = looseEpubs.length > 0 ? buildQueue(looseEpubs, [], 'plain') : [];
    const allItems = [...calibreItems, ...plainItems];

    setQueue(allItems);
    setMode(isCalibre && plainItems.length > 0 ? 'mixed' : isCalibre ? 'calibre' : 'files');
    setPhase('review');

    if (isCalibre) {
      toast(`Biblioteca Calibre detectada: ${calibreBooks.length} libros`, 'success');
    }
  };

  // --- Queue management ---

  const removeItem = (id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = useCallback((index, update) => {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...update } : item))
    );
  }, []);

  // --- Processing ---

  const startProcessing = async () => {
    setPhase('processing');
    cancelledRef.current = false;
    setCurrentIndex(0);

    const context = {
      books,
      uid: user?.uid,
      profile,
    };

    for (let i = 0; i < queue.length; i++) {
      if (cancelledRef.current) break;
      setCurrentIndex(i);

      await processQueueItem(
        queue[i],
        context,
        (update) => {
          updateItem(i, update);

          // Track Object URLs from Calibre covers for cleanup
          if (update.metadata?.coverUrl && update.metadata.coverUrl.startsWith('blob:')) {
            coverUrlsRef.current.push(update.metadata.coverUrl);
          }
        },
        // onNeedsIdentification: pause for user to manually identify the book
        (extractedMeta) =>
          new Promise((resolve) => {
            setIdTitle(extractedMeta.title || '');
            setIdAuthor(extractedMeta.author || '');
            setIdIsbn(extractedMeta.isbn || '');
            setIdentificationPromise({ resolve, extractedMeta, itemIndex: i });
          })
      );
    }

    setPhase('done');
  };

  const handleCancel = () => {
    cancelledRef.current = true;
  };

  // --- Manual identification handlers ---
  const handleIdentificationSubmit = () => {
    if (!identificationPromise) return;
    identificationPromise.resolve({
      title: idTitle.trim(),
      author: idAuthor.trim(),
      isbn: idIsbn.trim(),
    });
    setIdentificationPromise(null);
  };

  const handleIdentificationSkip = () => {
    if (!identificationPromise) return;
    identificationPromise.resolve(null);
    setIdentificationPromise(null);
  };

  // --- Stats ---
  const stats = {
    total: queue.length,
    done: queue.filter((q) => q.status === 'done').length,
    skipped: queue.filter((q) => q.status === 'skipped').length,
    errors: queue.filter((q) => q.status === 'error').length,
    pending: queue.filter((q) => q.status === 'pending').length,
  };

  const modeLabel = mode === 'calibre' ? 'Calibre' : mode === 'mixed' ? 'Calibre + EPUBs' : 'EPUBs';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'processing') onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape' && phase !== 'processing') onClose(); }}
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
        maxWidth: 640,
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
            {phase === 'done' ? 'Importacion completa' :
              phase === 'processing' ? 'Importando...' : <>Importar libros <HelpTip text="Selecciona multiples EPUBs o una carpeta de Calibre. Los archivos se guardan en tu navegador, nunca en la nube." size={16} position="bottom" /></>}
          </h2>
          {phase !== 'processing' && (
            <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>
              ✕
            </button>
          )}
        </div>

        {/* ===== PHASE: SELECT ===== */}
        {phase === 'select' && (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              Seleccioná múltiples EPUBs o una carpeta de biblioteca Calibre.
            </p>

            <div style={{ display: 'flex', gap: 16 }}>
              {/* Multi-file card */}
              <SelectCard
                icon="📚"
                title="Seleccionar archivos"
                subtitle="Múltiples .epub"
                onClick={() => fileInputRef.current?.click()}
              />

              {/* Calibre folder card */}
              <SelectCard
                icon="📂"
                title="Biblioteca Calibre"
                subtitle="Carpeta con metadata"
                onClick={() => folderInputRef.current?.click()}
              />
            </div>

            {/* Hidden inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
              multiple
              onChange={handleFilesSelected}
              style={{ display: 'none' }}
            />
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-ignore */
              webkitdirectory=""
              onChange={handleFolderSelected}
              style={{ display: 'none' }}
            />

            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 16, textAlign: 'center' }}>
              Si seleccionás una carpeta Calibre, se detectará automáticamente la metadata de cada libro.
            </p>
          </div>
        )}

        {/* ===== PHASE: REVIEW ===== */}
        {phase === 'review' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {queue.length} {queue.length === 1 ? 'libro' : 'libros'} detectados
                <span style={{
                  marginLeft: 8,
                  fontSize: 11,
                  padding: '2px 8px',
                  background: mode === 'calibre' || mode === 'mixed' ? 'rgba(39,174,96,0.15)' : 'var(--surface)',
                  color: mode === 'calibre' || mode === 'mixed' ? 'var(--success)' : 'var(--text-dim)',
                  borderRadius: 12,
                }}>
                  {modeLabel}
                </span>
              </span>
              <button
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setPhase('select'); setQueue([]); }}
              >
                ← Volver
              </button>
            </div>

            {/* Queue list */}
            <div style={{
              maxHeight: 400,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 20,
            }}>
              {queue.map((item) => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                }}>
                  <span style={{ fontSize: 16 }}>
                    {item.source === 'calibre' ? '📖' : '📄'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.filename}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {(item.fileSize / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="btn-ghost"
                    style={{ fontSize: 14, padding: '2px 6px', color: 'var(--text-dim)' }}
                    title="Quitar de la lista"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {queue.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No quedan libros en la lista.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={startProcessing}>
                  Comenzar importacion
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== PHASE: PROCESSING ===== */}
        {phase === 'processing' && (
          <div>
            {/* Overall progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}>
                <span>
                  {stats.done + stats.skipped + stats.errors} de {stats.total}
                  {stats.skipped > 0 && ` (${stats.skipped} omitidos)`}
                </span>
                <span>
                  {Math.round(((stats.done + stats.skipped + stats.errors) / stats.total) * 100)}%
                </span>
              </div>
              <div style={{
                background: 'var(--surface)',
                borderRadius: 4,
                overflow: 'hidden',
                height: 6,
              }}>
                <div style={{
                  height: '100%',
                  width: `${((stats.done + stats.skipped + stats.errors) / stats.total) * 100}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Queue status list */}
            <div style={{
              maxHeight: 400,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 20,
            }}>
              {queue.map((item, idx) => (
                <QueueStatusRow key={item.id} item={item} isCurrent={idx === currentIndex} />
              ))}
            </div>

            {/* Manual identification form */}
            {identificationPromise && (
              <div style={{
                padding: 16,
                marginBottom: 16,
                background: 'var(--surface)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Necesita identificación
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  El archivo "{identificationPromise.extractedMeta?.filename || ''}" no tiene suficiente metadata.
                  Ingresá el título y autor para buscar información.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={idTitle}
                    onChange={(e) => setIdTitle(e.target.value)}
                    placeholder="Título del libro"
                    style={{ fontSize: 13, padding: '8px 10px' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && idTitle.trim()) handleIdentificationSubmit();
                    }}
                  />
                  <input
                    value={idAuthor}
                    onChange={(e) => setIdAuthor(e.target.value)}
                    placeholder="Autor"
                    style={{ fontSize: 13, padding: '8px 10px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && idTitle.trim()) handleIdentificationSubmit();
                    }}
                  />
                  <input
                    value={idIsbn}
                    onChange={(e) => setIdIsbn(e.target.value)}
                    placeholder="ISBN (opcional)"
                    style={{ fontSize: 13, padding: '8px 10px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && idTitle.trim()) handleIdentificationSubmit();
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 13 }}
                      onClick={handleIdentificationSkip}
                    >
                      Omitir
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13 }}
                      disabled={!idTitle.trim()}
                      onClick={handleIdentificationSubmit}
                    >
                      Identificar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={cancelledRef.current}
              >
                {cancelledRef.current ? 'Cancelando...' : 'Cancelar importacion'}
              </button>
            </div>
          </div>
        )}

        {/* ===== PHASE: DONE ===== */}
        {phase === 'done' && (
          <div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginBottom: 24,
            }}>
              {stats.done > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(39,174,96,0.1)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--success)',
                  fontSize: 14,
                }}>
                  <span style={{ fontSize: 18 }}>✓</span>
                  {stats.done} {stats.done === 1 ? 'libro importado' : 'libros importados'}
                </div>
              )}

              {stats.skipped > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(193,123,63,0.1)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--accent)',
                  fontSize: 14,
                }}>
                  <span style={{ fontSize: 18 }}>⊘</span>
                  {stats.skipped} {stats.skipped === 1 ? 'duplicado omitido' : 'duplicados omitidos'}
                </div>
              )}

              {stats.errors > 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(192,57,43,0.1)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--danger)',
                  fontSize: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>✗</span>
                    {stats.errors} {stats.errors === 1 ? 'error' : 'errores'}
                  </div>
                  {queue
                    .filter((q) => q.status === 'error')
                    .map((q) => (
                      <div key={q.id} style={{ fontSize: 12, marginBottom: 4, paddingLeft: 28 }}>
                        <strong>{q.filename}:</strong> {q.error}
                      </div>
                    ))
                  }
                </div>
              )}

              {stats.pending > 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-dim)',
                  fontSize: 14,
                }}>
                  {stats.pending} {stats.pending === 1 ? 'libro no procesado' : 'libros no procesados'} (cancelado)
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function SelectCard({ icon, title, subtitle, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        padding: 24,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'border-color var(--transition), background var(--transition)',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.background = 'var(--accent-soft)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--surface)';
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{subtitle}</div>
    </div>
  );
}

function QueueStatusRow({ item, isCurrent }) {
  const statusDisplay = () => {
    switch (item.status) {
      case 'pending':
        return <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Pendiente</span>;
      case 'hashing':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
            Verificando...
          </span>
        );
      case 'parsing':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
            Analizando...
          </span>
        );
      case 'needs_identification':
        return (
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            ⚠ Necesita identificación
          </span>
        );
      case 'uploading':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
            <div style={{
              flex: 1,
              background: 'var(--bg)',
              borderRadius: 3,
              overflow: 'hidden',
              height: 4,
            }}>
              <div style={{
                height: '100%',
                width: `${item.progress}%`,
                background: 'var(--accent)',
                transition: 'width 0.2s ease',
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {item.progress}%
            </span>
          </div>
        );
      case 'done':
        return <span style={{ color: 'var(--success)', fontSize: 13 }}>✓</span>;
      case 'skipped':
        return (
          <span style={{ fontSize: 11, color: 'var(--accent)' }} title={item.skipReason}>
            Omitido
          </span>
        );
      case 'error':
        return (
          <span style={{ fontSize: 11, color: 'var(--danger)' }} title={item.error}>
            Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      background: isCurrent ? 'var(--accent-soft)' : 'var(--surface)',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
      transition: 'background var(--transition)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isCurrent ? 600 : 400,
        }}>
          {item.metadata?.title || item.filename}
        </div>
        {item.metadata?.author && item.metadata.author !== 'Desconocido' && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {item.metadata.author}
          </div>
        )}
        {item.status === 'skipped' && item.skipReason && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
            {item.skipReason}
          </div>
        )}
        {item.status === 'error' && item.error && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
            {item.error}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {statusDisplay()}
      </div>
    </div>
  );
}
