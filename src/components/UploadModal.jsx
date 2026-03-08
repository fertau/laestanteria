import { useState, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc as docRef } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { parseEpub } from '../lib/epubParser';
import { parseFilename } from '../lib/parseFilename';
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

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// Simple Levenshtein distance
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(la, lb) / maxLen;
}

export default function UploadModal({ onClose }) {
  const { books, uploadBook } = useBooks();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [fileHash, setFileHash] = useState(null);

  const [isbn, setIsbn] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metaSource, setMetaSource] = useState(null); // 'epub' | 'google' | 'openlibrary' | null

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('es');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [epubCoverUrl, setEpubCoverUrl] = useState(''); // Object URL from EPUB cover

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Duplicate detection state
  const [dupCheck, setDupCheck] = useState(null);
  const [dupAction, setDupAction] = useState(null);

  /**
   * Search external APIs for metadata using title+author or ISBN.
   * Merges results: EPUB metadata → Google Books → Open Library
   * Only fills in empty fields (doesn't overwrite what the EPUB already provided).
   */
  const enrichMetadata = async (epubMeta) => {
    const currentTitle = epubMeta?.title || '';
    const currentAuthor = epubMeta?.author || '';
    const currentISBN = epubMeta?.isbn || '';

    let apiResults = [];

    // Search in parallel: Google Books + Open Library
    const searches = [];

    if (currentISBN) {
      searches.push(gbISBN(currentISBN));
      searches.push(fetchByISBN(currentISBN));
    }
    if (currentTitle) {
      searches.push(gbSearch(currentTitle, currentAuthor));
      searches.push(olSearch(currentTitle, currentAuthor));
    }

    if (searches.length === 0) return;

    try {
      const results = await Promise.allSettled(searches);
      apiResults = results
        .filter((r) => r.status === 'fulfilled' && r.value)
        .map((r) => r.value);
    } catch {
      // Silently fail — EPUB metadata is enough
    }

    if (apiResults.length === 0) return;

    // Merge: fill in what's missing
    // Priority: what's already set > Google Books > Open Library
    let enriched = false;

    for (const result of apiResults) {
      if (!title && result.title) {
        setTitle(result.title);
        enriched = true;
      }
      if (!author && result.author) {
        setAuthor(result.author);
        enriched = true;
      }
      if (!description && result.description) {
        setDescription(result.description);
        enriched = true;
      }
      if (!coverUrl && !epubCoverUrl && result.coverUrl) {
        setCoverUrl(result.coverUrl);
        enriched = true;
      }
      // Prefer API cover over EPUB cover (usually higher quality)
      if (epubCoverUrl && !coverUrl && result.coverUrl) {
        setCoverUrl(result.coverUrl);
        enriched = true;
      }
      if (!genre && result.genre) {
        // Try to map to our genre list
        const mapped = mapGenre(result.genre);
        if (mapped) {
          setGenre(mapped);
          enriched = true;
        }
      }
      if (!isbn && result.isbn) {
        setIsbn(result.isbn);
        enriched = true;
      }
      if (result.language && language === 'es') {
        // Only override default if API gives a different language
        if (result.language !== 'es') {
          setLanguage(result.language);
          enriched = true;
        }
      }
    }

    // Track which source provided the most data
    const bestSource = apiResults[0]?.source || null;
    if (enriched && bestSource) {
      setMetaSource(bestSource);
    }

    return enriched;
  };

  /**
   * Try to map a free-text genre string to one of our GENRES.
   */
  const mapGenre = (genreStr) => {
    if (!genreStr) return '';
    const g = genreStr.toLowerCase();
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
      if (regex.test(g)) return mapped;
    }
    return '';
  };

  // Validate EPUB file + auto-extract metadata
  const validateFile = async (f) => {
    setFileError(null);
    setFile(null);
    setFileHash(null);
    setDupCheck(null);
    setDupAction(null);
    setMetaSource(null);

    if (!f.name.toLowerCase().endsWith('.epub')) {
      setFileError('Solo se admiten archivos EPUB. Los PDF no son compatibles con Kindle.');
      return;
    }

    if (f.size > MAX_SIZE) {
      const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
      setFileError(`El archivo pesa ${sizeMB} MB. El limite es 50 MB.`);
      return;
    }

    const header = await f.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(header);
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      setFileError('El archivo no es un EPUB valido (no tiene formato ZIP).');
      return;
    }

    // Calculate SHA-256 hash
    const buffer = await f.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    setFile(f);
    setFileHash(hashHex);

    // Level 1: Check for exact hash match
    const hashMatch = books.find((b) => b.fileHash === hashHex);
    if (hashMatch) {
      setDupCheck({
        type: 'hash',
        match: hashMatch,
        message: `Este archivo ya existe: "${hashMatch.title}" de ${hashMatch.author}`,
      });
      return;
    }

    // --- Step 1: Smart filename parsing (always runs first) ---
    const filenameMeta = parseFilename(f.name);
    let fnTitle = filenameMeta.title || '';
    let fnAuthor = filenameMeta.author || '';
    let fnIsbn = filenameMeta.isbn || '';

    // Pre-fill form with filename data immediately
    if (fnTitle) setTitle(fnTitle);
    if (fnAuthor) setAuthor(fnAuthor);
    if (fnIsbn) setIsbn(fnIsbn);

    // --- Step 2: Parse EPUB OPF metadata + cover ---
    setFetchingMeta(true);
    try {
      const epubMeta = await parseEpub(f);

      if (epubMeta) {
        // OPF data overrides filename data (more reliable when available)
        if (epubMeta.title) { setTitle(epubMeta.title); fnTitle = epubMeta.title; }
        if (epubMeta.author) { setAuthor(epubMeta.author); fnAuthor = epubMeta.author; }
        if (epubMeta.isbn) { setIsbn(epubMeta.isbn); fnIsbn = epubMeta.isbn; }
        if (epubMeta.description) setDescription(epubMeta.description);
        if (epubMeta.language) setLanguage(epubMeta.language);
        if (epubMeta.coverObjectUrl) setEpubCoverUrl(epubMeta.coverObjectUrl);
        if (epubMeta.subjects?.length) {
          const mapped = mapGenre(epubMeta.subjects.join(', '));
          if (mapped) setGenre(mapped);
        }

        setMetaSource('epub');
        toast('Metadata extraida del EPUB', 'success');
      }

      // --- Step 3: Enrich with APIs using best available data ---
      // Use whichever source gave us data (EPUB overrides filename)
      const bestTitle = fnTitle;
      const bestAuthor = fnAuthor;
      const bestIsbn = fnIsbn;

      if (bestTitle || bestIsbn) {
        const enriched = await enrichMetadata({
          title: bestTitle,
          author: bestAuthor,
          isbn: bestIsbn,
        });
        if (enriched) {
          toast('Metadata completada con APIs externas', 'success');
        }
      }
    } catch (err) {
      console.warn('EPUB parsing failed, searching APIs with filename data:', err);
      // EPUB parse failed but we still have filename data — try APIs
      if (fnTitle || fnIsbn) {
        try {
          await enrichMetadata({ title: fnTitle, author: fnAuthor, isbn: fnIsbn });
        } catch {
          // Silently fail
        }
      }
    } finally {
      setFetchingMeta(false);
    }
  };

  // Run additional duplicate checks before submit
  const checkDuplicates = async () => {
    // Level 2: ISBN match
    if (isbn.trim()) {
      const isbnClean = isbn.replace(/[-\s]/g, '');
      const isbnMatch = books.find((b) => b.isbn && b.isbn.replace(/[-\s]/g, '') === isbnClean);
      if (isbnMatch) {
        return {
          type: 'isbn',
          match: isbnMatch,
          message: `Ya existe un libro con ISBN ${isbn}: "${isbnMatch.title}" (${isbnMatch.language?.toUpperCase()})`,
        };
      }
    }

    // Level 3: Fuzzy title+author match
    if (title.trim() && author.trim()) {
      for (const b of books) {
        const titleSim = similarity(title, b.title);
        const authorSim = similarity(author, b.author);
        if (titleSim > 0.8 && authorSim > 0.8) {
          return {
            type: 'fuzzy',
            match: b,
            message: `Se encontro un libro similar: "${b.title}" de ${b.author} (${b.language?.toUpperCase()})`,
          };
        }
      }
    }

    return null;
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) validateFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) validateFile(f);
  };

  // Manual ISBN search
  const handleISBNSearch = async () => {
    if (!isbn.trim()) return;
    setFetchingMeta(true);
    try {
      // Search both APIs in parallel
      const [olResult, gbResult] = await Promise.allSettled([
        fetchByISBN(isbn),
        gbISBN(isbn),
      ]);

      const ol = olResult.status === 'fulfilled' ? olResult.value : null;
      const gb = gbResult.status === 'fulfilled' ? gbResult.value : null;

      // Prefer Google Books for cover, merge both
      const best = gb || ol;
      if (best) {
        if (best.title && !title) setTitle(best.title);
        if (best.author && !author) setAuthor(best.author);
        if (best.description && !description) setDescription(best.description);
        if (best.genre) {
          const mapped = mapGenre(best.genre);
          if (mapped && !genre) setGenre(mapped);
        }

        // Cover: prefer Google Books (higher quality), fall back to Open Library
        const bestCover = gb?.coverUrl || ol?.coverUrl || '';
        if (bestCover) setCoverUrl(bestCover);

        if (best.language) setLanguage(best.language);

        setMetaSource(best.source);
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

  // Manual search by title+author
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
        if (best.description && !description) setDescription(best.description);
        if (best.genre) {
          const mapped = mapGenre(best.genre);
          if (mapped && !genre) setGenre(mapped);
        }

        const bestCover = gb?.coverUrl || ol?.coverUrl || '';
        if (bestCover) setCoverUrl(bestCover);

        if (best.isbn && !isbn) setIsbn(best.isbn);
        if (best.language) setLanguage(best.language);

        setMetaSource(best.source);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim() || !author.trim() || !language) return;

    // If hash duplicate detected, don't allow upload
    if (dupCheck?.type === 'hash' && dupAction !== 'proceed') {
      toast('Este archivo ya esta en la estanteria', 'info');
      return;
    }

    // Run additional duplicate checks if not already resolved
    if (!dupCheck && !dupAction) {
      const dup = await checkDuplicates();
      if (dup) {
        setDupCheck(dup);
        return;
      }
    }

    // Determine bookGroupId
    let bookGroupId = null;
    if (dupAction === 'group' && dupCheck?.match) {
      bookGroupId = dupCheck.match.bookGroupId || crypto.randomUUID();
    }

    // Use the best available cover URL (never save blob: URLs — they break on reload)
    const rawCover = coverUrl || epubCoverUrl || '';
    const finalCoverUrl = rawCover.startsWith('blob:') ? '' : rawCover;

    setUploading(true);
    setProgress(0);
    try {
      await uploadBook(file, {
        title: title.trim(),
        author: author.trim(),
        genre,
        language,
        description: description.trim(),
        coverUrl: finalCoverUrl,
        fileHash,
        isbn: isbn.trim() || null,
        bookGroupId,
      }, setProgress);

      // If grouping, update the matched book's bookGroupId too
      if (dupAction === 'group' && dupCheck?.match && !dupCheck.match.bookGroupId && bookGroupId) {
        await updateDoc(docRef(db, 'books', dupCheck.match.id), { bookGroupId });
      }

      toast('Libro agregado!', 'success');
      onClose();
    } catch (err) {
      toast('Error al subir: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Determine which cover to show in preview
  const previewCover = coverUrl || epubCoverUrl || '';

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
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
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 28,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
            Subir libro
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>
            X
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${fileError ? 'var(--danger)' : file ? 'var(--success)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: 24,
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
              transition: 'border-color var(--transition)',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".epub"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {file ? (
              <div>
                <div style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 4 }}>
                  {file.name}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  Arrastra un EPUB o hace click para seleccionar
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  Solo .epub, maximo 50 MB
                </div>
              </div>
            )}
          </div>

          {fileError && (
            <div style={{
              color: 'var(--danger)',
              fontSize: 13,
              marginBottom: 16,
              padding: '8px 12px',
              background: 'rgba(192,57,43,0.1)',
              borderRadius: 'var(--radius)',
            }}>
              {fileError}
            </div>
          )}

          {/* Metadata extraction status */}
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

          {metaSource && !fetchingMeta && (
            <div style={{
              fontSize: 12,
              color: 'var(--success)',
              marginBottom: 12,
              padding: '6px 10px',
              background: 'rgba(39,174,96,0.1)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>✓</span>
              Metadata {metaSource === 'epub' ? 'extraida del EPUB' :
                metaSource === 'google' ? 'de Google Books' : 'de Open Library'}
            </div>
          )}

          {/* Duplicate warning */}
          {dupCheck && !dupAction && (
            <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--accent)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
                {dupCheck.type === 'hash' ? 'Duplicado exacto' :
                  dupCheck.type === 'isbn' ? 'Mismo ISBN' : 'Titulo similar'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                {dupCheck.message}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dupCheck.type === 'hash' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                    onClick={onClose}
                  >
                    Cancelar upload
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: 12 }}
                      onClick={() => setDupAction('group')}
                    >
                      Agrupar como edicion
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => setDupAction('proceed')}
                    >
                      Subir como libro nuevo
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={onClose}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {dupAction && (
            <div style={{
              fontSize: 12,
              color: 'var(--success)',
              marginBottom: 12,
              padding: '6px 10px',
              background: 'rgba(39,174,96,0.1)',
              borderRadius: 'var(--radius)',
            }}>
              {dupAction === 'group'
                ? `Se agrupara como edicion con "${dupCheck?.match?.title}"`
                : 'Se subira como libro independiente'}
            </div>
          )}

          {/* Cover preview + metadata side by side */}
          {previewCover && (
            <div style={{
              display: 'flex',
              gap: 16,
              marginBottom: 16,
              padding: 12,
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
            }}>
              <img
                src={previewCover}
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

          {/* ISBN */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              ISBN (opcional — autocompleta metadata)
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
              placeholder={epubCoverUrl ? 'Se usara la portada del EPUB' : 'https://...'}
              style={{ width: '100%' }}
            />
            {!previewCover && !coverUrl && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Se detectara automaticamente del EPUB o de APIs externas
              </div>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div style={{
              background: 'var(--surface)',
              borderRadius: 4,
              overflow: 'hidden',
              height: 6,
              marginBottom: 16,
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file || !title.trim() || !author.trim() || (dupCheck?.type === 'hash' && !dupAction) || fetchingMeta}
            >
              {uploading ? `Subiendo... ${progress}%` : 'Subir libro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
