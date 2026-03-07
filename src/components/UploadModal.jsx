import { useState, useRef } from 'react';
import { useBooks } from '../hooks/useBooks';
import { useToast } from '../hooks/useToast';
import { fetchByISBN } from '../lib/openLibrary';

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

export default function UploadModal({ onClose }) {
  const { uploadBook } = useBooks();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [fileHash, setFileHash] = useState(null);

  const [isbn, setIsbn] = useState('');
  const [fetchingISBN, setFetchingISBN] = useState(false);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('es');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Validate EPUB file
  const validateFile = async (f) => {
    setFileError(null);
    setFile(null);
    setFileHash(null);

    // Extension check
    if (!f.name.toLowerCase().endsWith('.epub')) {
      setFileError('Solo se admiten archivos EPUB. Los PDF no son compatibles con Kindle.');
      return;
    }

    // Size check
    if (f.size > MAX_SIZE) {
      const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
      setFileError(`El archivo pesa ${sizeMB} MB. El limite es 50 MB.`);
      return;
    }

    // Binary validation: EPUB is a ZIP (PK\x03\x04)
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

    // Try to extract title from filename
    const nameWithoutExt = f.name.replace(/\.epub$/i, '');
    if (!title) {
      // Try "Author - Title" format
      const parts = nameWithoutExt.split(' - ');
      if (parts.length >= 2) {
        setAuthor(parts[0].trim());
        setTitle(parts.slice(1).join(' - ').trim());
      } else {
        setTitle(nameWithoutExt);
      }
    }
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

  const handleISBNSearch = async () => {
    if (!isbn.trim()) return;
    setFetchingISBN(true);
    try {
      const data = await fetchByISBN(isbn);
      if (data) {
        if (data.title) setTitle(data.title);
        if (data.author) setAuthor(data.author);
        if (data.description) setDescription(data.description);
        if (data.coverUrl) setCoverUrl(data.coverUrl);
        if (data.genre) setGenre(data.genre);
        toast('Metadata encontrada en Open Library', 'success');
      } else {
        toast('No se encontro el ISBN en Open Library', 'info');
      }
    } catch {
      toast('Error al buscar ISBN', 'error');
    } finally {
      setFetchingISBN(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim() || !author.trim() || !language) return;

    setUploading(true);
    setProgress(0);
    try {
      await uploadBook(file, {
        title: title.trim(),
        author: author.trim(),
        genre,
        language,
        description: description.trim(),
        coverUrl,
        fileHash,
        isbn: isbn.trim() || null,
        bookGroupId: null,
      }, setProgress);

      toast('Libro agregado!', 'success');
      onClose();
    } catch (err) {
      toast('Error al subir: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
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
                disabled={fetchingISBN || !isbn.trim()}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                {fetchingISBN ? '...' : 'Buscar'}
              </button>
            </div>
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
            {coverUrl && (
              <img
                src={coverUrl}
                alt="Preview"
                style={{ marginTop: 8, height: 80, borderRadius: 4 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
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
              disabled={uploading || !file || !title.trim() || !author.trim()}
            >
              {uploading ? `Subiendo... ${progress}%` : 'Subir libro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
