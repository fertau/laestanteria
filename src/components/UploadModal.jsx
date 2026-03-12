import { useState, useRef, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc as docRef } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { parseEpub } from '../lib/epubParser';
import { parseFilename } from '../lib/parseFilename';
import { fetchByISBN, searchByTitleAuthor as olSearch, searchCovers as olSearchCovers } from '../lib/openLibrary';
import { searchByISBN as gbISBN, searchByTitleAuthor as gbSearch, searchCovers as gbSearchCovers } from '../lib/googleBooks';
import HelpTip from './HelpTip';
import { isValidCover } from '../lib/coverUtils';

const GENRES = [
  'Ficcion', 'No ficcion', 'Ciencia ficcion', 'Fantasia', 'Misterio',
  'Romance', 'Historia', 'Ciencia', 'Filosofia', 'Biografia',
  'Autoayuda', 'Negocios', 'Arte', 'Poesia', 'Infantil', 'Otro',
];

const LANGUAGES = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
  { value: 'pt', label: 'PT' },
  { value: 'fr', label: 'FR' },
  { value: 'de', label: 'DE' },
  { value: 'it', label: 'IT' },
  { value: 'other', label: 'Otro' },
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

/* ---- Shared label style (matches EditBookModal) ---- */
const labelSt = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 };

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

/**
 * Validate cover URLs and auto-select the first real one (not a placeholder).
 * Runs asynchronously — sets the cover as soon as a valid one is found.
 */
async function autoSelectValidCover(urls, setCoverUrl) {
  for (const url of urls) {
    if (!url) continue;
    if (await isValidCover(url)) {
      setCoverUrl(url);
      return;
    }
  }
  // If no cover passes validation, use the first one anyway (better than nothing)
  if (urls.length > 0 && urls[0]) {
    setCoverUrl(urls[0]);
  }
}

export default function UploadModal({ onClose }) {
  const { books, uploadBook } = useBooks();
  const { toast } = useToast();
  const fileRef = useRef(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
    let foundCover = false;
    const coverCandidates = [];

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
      // Collect cover candidates (validated later)
      if (result.coverUrl && !foundCover) {
        coverCandidates.push(result.coverUrl);
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

    // Auto-select the first valid cover from candidates
    if (coverCandidates.length > 0 && !coverUrl) {
      foundCover = true;
      enriched = true;
      autoSelectValidCover(coverCandidates, setCoverUrl);
    }

    // Track which source provided the most data
    const bestSource = apiResults[0]?.source || null;
    if (enriched && bestSource) {
      setMetaSource(bestSource);
    }

    return { enriched, foundCover };
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
        const enrichResult = await enrichMetadata({
          title: bestTitle,
          author: bestAuthor,
          isbn: bestIsbn,
        });
        if (enrichResult?.enriched) {
          toast('Metadata completada con APIs externas', 'success');
        }

        // Fallback: broader cover search if enrichment didn't find a cover
        if (!enrichResult?.foundCover) {
          try {
            const [gbC, olC] = await Promise.allSettled([
              gbSearchCovers(bestTitle, bestAuthor, bestIsbn),
              olSearchCovers(bestTitle, bestAuthor, bestIsbn),
            ]);
            const allCovers = [
              ...(gbC.status === 'fulfilled' ? gbC.value : []),
              ...(olC.status === 'fulfilled' ? olC.value : []),
            ];
            if (allCovers.length > 0) {
              autoSelectValidCover(allCovers.map((c) => c.url), setCoverUrl);
            }
          } catch {
            // Silently fail
          }
        }
      }
    } catch (err) {
      console.warn('EPUB parsing failed, searching APIs with filename data:', err);
      // EPUB parse failed but we still have filename data — try APIs
      if (fnTitle || fnIsbn) {
        try {
          const enrichResult = await enrichMetadata({ title: fnTitle, author: fnAuthor, isbn: fnIsbn });

          // Fallback cover search if enrichment didn't find a cover
          if (!enrichResult?.foundCover) {
            try {
              const [gbC, olC] = await Promise.allSettled([
                gbSearchCovers(fnTitle, fnAuthor, fnIsbn),
                olSearchCovers(fnTitle, fnAuthor, fnIsbn),
              ]);
              const allCovers = [
                ...(gbC.status === 'fulfilled' ? gbC.value : []),
                ...(olC.status === 'fulfilled' ? olC.value : []),
              ];
              if (allCovers.length > 0) {
                autoSelectValidCover(allCovers.map((c) => c.url), setCoverUrl);
              }
            } catch {
              // Silently fail
            }
          }
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

  // Manual unified search (✨ button) — searches by ISBN and/or title+author
  const handleManualSearch = async () => {
    if (!title.trim() && !isbn.trim()) {
      toast('Ingresa un titulo o ISBN primero', 'info');
      return;
    }
    setFetchingMeta(true);
    try {
      const result = await enrichMetadata({ title, author, isbn });
      if (result?.enriched) {
        toast('Metadata encontrada!', 'success');
      } else {
        toast('No se encontraron resultados', 'info');
      }
      // Broader cover search if no cover found
      if (!result?.foundCover && !coverUrl) {
        const [gbC, olC] = await Promise.allSettled([
          gbSearchCovers(title, author, isbn),
          olSearchCovers(title, author, isbn),
        ]);
        const allCovers = [
          ...(gbC.status === 'fulfilled' ? gbC.value : []),
          ...(olC.status === 'fulfilled' ? olC.value : []),
        ];
        if (allCovers.length > 0) {
          autoSelectValidCover(allCovers.map((c) => c.url), setCoverUrl);
        }
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
      toast('Error al agregar: ' + err.message, 'error');
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
        maxWidth: 540,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0 }}>
            Agregar libro
            <HelpTip text="El EPUB se guarda en tu navegador. Solo se comparte la metadata (titulo, autor, portada) con otros usuarios." size={14} position="bottom" />
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 16, padding: '2px 6px' }}>✕</button>
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
              padding: 18,
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 14,
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
                      Agregar como libro nuevo
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

          {/* Cover + Title + Author — top row (matches EditBookModal) */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            {/* Cover preview */}
            <div style={{
              width: 80, height: 120, borderRadius: 4, overflow: 'hidden', flexShrink: 0,
              background: 'var(--surface)',
              border: previewCover ? '2px solid var(--accent)' : '2px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {previewCover ? (
                <img
                  src={previewCover}
                  alt="Portada"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 4 }}>
                  Sin portada
                </span>
              )}
              {previewCover && (
                <button
                  type="button"
                  onClick={() => { setCoverUrl(''); setEpubCoverUrl(''); }}
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', color: '#fff',
                    fontSize: 10, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}
                  title="Quitar portada"
                >✕</button>
              )}
            </div>

            {/* Title + Author + ✨ Search */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={labelSt}>Titulo *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: 13, padding: '8px 10px' }}
                />
              </div>
              <div>
                <label style={labelSt}>Autor *</label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: 13, padding: '8px 10px' }}
                />
              </div>
              {/* Magic wand — same style as EditBookModal */}
              <button
                type="button"
                onClick={handleManualSearch}
                disabled={fetchingMeta || (!title.trim() && !isbn.trim())}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px dashed var(--accent)',
                  borderRadius: 'var(--radius)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  opacity: (fetchingMeta || (!title.trim() && !isbn.trim())) ? 0.4 : 1,
                  transition: 'all var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 14 }}>✨</span>
                {fetchingMeta ? 'Buscando...' : 'Buscar metadata'}
              </button>
            </div>
          </div>

          {/* Genre + Language + ISBN — one row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 2 }}>
              <label style={labelSt}>Genero</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '8px 10px' }}>
                <option value="">—</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Idioma *</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} required style={{ width: '100%', fontSize: 13, padding: '8px 10px' }}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelSt}>ISBN</label>
              <input
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-..."
                style={{ width: '100%', fontSize: 13, padding: '8px 10px' }}
              />
            </div>
          </div>

          {/* Cover URL */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>URL portada</label>
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder={epubCoverUrl ? 'Se usara la portada del EPUB' : 'Pegar URL de portada...'}
              style={{ width: '100%', fontSize: 12, padding: '8px 10px' }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Descripcion</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', fontSize: 13, padding: '8px 10px' }}
            />
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
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file || !title.trim() || !author.trim() || (dupCheck?.type === 'hash' && !dupAction) || fetchingMeta}
              style={{ fontSize: 12, padding: '8px 18px' }}
            >
              {uploading ? `Guardando... ${progress}%` : 'Agregar libro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
