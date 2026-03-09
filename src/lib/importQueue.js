/**
 * Import queue engine for bulk book import.
 * Handles both multi-file (plain) and Calibre mode.
 *
 * IMPORTANT: This module calls Drive/Firestore directly instead of going
 * through useBooks.uploadBook. This avoids per-book token refresh popups
 * that get blocked by the browser in async loops.
 * The token and folderId are obtained ONCE before the loop starts
 * (in ImportModal.startProcessing, triggered by user click).
 */

import { parseFilename } from './parseFilename';
import { parseEpub } from './epubParser';
import { parseCalibreOpf, getCalibreCoverUrl } from './calibreParser';
import { fetchByISBN, searchByTitleAuthor as olSearch, searchCovers as olSearchCovers } from './openLibrary';
import { searchByISBN as gbISBN, searchByTitleAuthor as gbSearch, searchCovers as gbSearchCovers } from './googleBooks';
import { uploadEpubToDrive, shareWithServiceAccount } from './googleDrive';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Genre mapping: same as UploadModal + calibreParser.
 */
const GENRE_MAP = [
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

function mapGenre(genreStr) {
  if (!genreStr) return '';
  for (const [regex, mapped] of GENRE_MAP) {
    if (regex.test(genreStr)) return mapped;
  }
  return '';
}

/**
 * Compute SHA-256 hash for a file.
 * @param {File} file
 * @returns {Promise<string>} hex hash
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the initial queue from either multi-file selection or Calibre bundles.
 *
 * @param {File[]} epubFiles - epub files selected directly (multi-file mode)
 * @param {CalibreBookBundle[]} calibreBooks - from detectCalibreStructure
 * @param {'calibre'|'plain'} source
 * @returns {ImportQueueItem[]}
 */
export function buildQueue(epubFiles, calibreBooks, source) {
  const items = [];

  if (source === 'calibre') {
    for (const bundle of calibreBooks) {
      items.push({
        id: crypto.randomUUID(),
        file: bundle.epub,
        filename: bundle.epub.name,
        fileSize: bundle.epub.size,
        status: 'pending',
        progress: 0,
        error: null,
        skipReason: null,
        metadata: null,
        fileHash: null,
        source: 'calibre',
        opfFile: bundle.opfFile,
        coverFile: bundle.coverFile,
      });
    }
  }

  // Plain mode: each epub is a standalone item
  for (const file of epubFiles) {
    items.push({
      id: crypto.randomUUID(),
      file,
      filename: file.name,
      fileSize: file.size,
      status: 'pending',
      progress: 0,
      error: null,
      skipReason: null,
      metadata: null,
      fileHash: null,
      source: 'plain',
      opfFile: null,
      coverFile: null,
    });
  }

  return items;
}

/**
 * Enrich metadata with Google Books + Open Library.
 * Pure function (no React state).
 *
 * @param {Object} baseMeta - { title, author, isbn }
 * @returns {Promise<Object>} - merged metadata with additional fields
 */
export async function enrichMetadataStandalone(baseMeta) {
  const searches = [];

  if (baseMeta.isbn) {
    searches.push(gbISBN(baseMeta.isbn));
    searches.push(fetchByISBN(baseMeta.isbn));
  }
  if (baseMeta.title) {
    searches.push(gbSearch(baseMeta.title, baseMeta.author));
    searches.push(olSearch(baseMeta.title, baseMeta.author));
  }

  if (searches.length === 0) return baseMeta;

  const results = await Promise.allSettled(searches);
  const apiResults = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  let enriched = { ...baseMeta };
  for (const result of apiResults) {
    if (!enriched.title && result.title) enriched.title = result.title;
    if (!enriched.author && result.author) enriched.author = result.author;
    if (!enriched.description && result.description) enriched.description = result.description;
    if (!enriched.coverUrl && result.coverUrl) enriched.coverUrl = result.coverUrl;
    if (!enriched.genre && result.genre) enriched.genre = mapGenre(result.genre);
    if (!enriched.isbn && result.isbn) enriched.isbn = result.isbn;
    if (!enriched.language && result.language) enriched.language = result.language;
  }

  return enriched;
}

/**
 * Process a single queue item through the full pipeline.
 * Uses pre-fetched accessToken and folderId to avoid per-book token popups.
 *
 * @param {ImportQueueItem} item
 * @param {Object} context - { books, accessToken, folderId, uid, profile }
 * @param {(update: Partial<ImportQueueItem>) => void} onUpdate
 * @returns {Promise<'done'|'skipped'|'error'>}
 */
export async function processQueueItem(item, context, onUpdate) {
  const { books, accessToken, folderId, uid, profile } = context;

  try {
    // --- Phase 1: Hash ---
    onUpdate({ status: 'hashing' });
    const fileHash = await hashFile(item.file);
    onUpdate({ fileHash });

    // --- Phase 2: Duplicate check ---
    const hashMatch = books.find((b) => b.fileHash === fileHash);
    if (hashMatch) {
      onUpdate({
        status: 'skipped',
        skipReason: `Duplicado: "${hashMatch.title}" de ${hashMatch.author}`,
      });
      return 'skipped';
    }

    // --- Phase 3: Metadata extraction ---
    onUpdate({ status: 'parsing' });

    let meta = {
      title: '',
      author: '',
      genre: '',
      language: 'es',
      description: '',
      coverUrl: '',
      isbn: '',
    };

    if (item.source === 'calibre' && item.opfFile) {
      // Calibre mode: use metadata.opf
      try {
        const opfMeta = await parseCalibreOpf(item.opfFile);
        if (opfMeta.title) meta.title = opfMeta.title;
        if (opfMeta.author) meta.author = opfMeta.author;
        if (opfMeta.isbn) meta.isbn = opfMeta.isbn;
        if (opfMeta.description) meta.description = opfMeta.description;
        if (opfMeta.language) meta.language = opfMeta.language;
        if (opfMeta.genre) meta.genre = opfMeta.genre;
      } catch (err) {
        console.warn('Calibre OPF parse failed, falling back to filename:', err);
      }

      // Cover from Calibre folder
      if (item.coverFile) {
        try {
          meta.coverUrl = getCalibreCoverUrl(item.coverFile);
        } catch { /* ignore */ }
      }

      // No API enrichment for Calibre — metadata is complete
    } else {
      // Plain mode: filename → EPUB OPF → API enrichment
      const filenameMeta = parseFilename(item.filename);
      if (filenameMeta.title) meta.title = filenameMeta.title;
      if (filenameMeta.author) meta.author = filenameMeta.author;
      if (filenameMeta.isbn) meta.isbn = filenameMeta.isbn;

      // EPUB OPF parsing
      try {
        const epubMeta = await parseEpub(item.file);
        if (epubMeta) {
          if (epubMeta.title) meta.title = epubMeta.title;
          if (epubMeta.author) meta.author = epubMeta.author;
          if (epubMeta.isbn) meta.isbn = epubMeta.isbn;
          if (epubMeta.description) meta.description = epubMeta.description;
          if (epubMeta.language) meta.language = epubMeta.language;
          if (epubMeta.coverObjectUrl) meta.coverUrl = epubMeta.coverObjectUrl;
          if (epubMeta.subjects?.length) {
            const mapped = mapGenre(epubMeta.subjects.join(', '));
            if (mapped) meta.genre = mapped;
          }
        }
      } catch (err) {
        console.warn('EPUB parse failed:', err);
      }

      // API enrichment (only for plain mode)
      if (meta.title || meta.isbn) {
        try {
          const enriched = await enrichMetadataStandalone({
            title: meta.title,
            author: meta.author,
            isbn: meta.isbn,
          });
          if (!meta.title && enriched.title) meta.title = enriched.title;
          if (!meta.author && enriched.author) meta.author = enriched.author;
          if (!meta.description && enriched.description) meta.description = enriched.description;
          if (!meta.coverUrl && enriched.coverUrl) meta.coverUrl = enriched.coverUrl;
          if (!meta.genre && enriched.genre) meta.genre = enriched.genre;
          if (!meta.isbn && enriched.isbn) meta.isbn = enriched.isbn;
          if (!meta.language && enriched.language) meta.language = enriched.language;
          // Prefer API cover for higher quality
          if (enriched.coverUrl && meta.coverUrl !== enriched.coverUrl) {
            meta.coverUrl = enriched.coverUrl;
          }
        } catch {
          // Silently fail — EPUB/filename metadata is enough
        }
      }

      // Fallback: if cover is still a blob: URL or empty, try broader cover search
      if (!meta.coverUrl || meta.coverUrl.startsWith('blob:')) {
        try {
          const [gbC, olC] = await Promise.allSettled([
            gbSearchCovers(meta.title, meta.author, meta.isbn),
            olSearchCovers(meta.title, meta.author, meta.isbn),
          ]);
          const allCovers = [
            ...(gbC.status === 'fulfilled' ? gbC.value : []),
            ...(olC.status === 'fulfilled' ? olC.value : []),
          ];
          if (allCovers.length > 0) {
            meta.coverUrl = allCovers[0].url;
          }
        } catch {
          // Silently fail
        }
      }
    }

    // Fallbacks
    if (!meta.title) meta.title = item.filename.replace(/\.epub$/i, '');
    if (!meta.author) meta.author = 'Desconocido';

    onUpdate({ metadata: meta });

    // --- Phase 4: Upload directly to Drive + Firestore ---
    // (bypasses uploadBook to avoid per-book token refresh)
    onUpdate({ status: 'uploading' });

    const driveTitle = `${meta.author.trim()} - ${meta.title.trim()}`;
    const { driveFileId } = await uploadEpubToDrive(
      accessToken,
      item.file,
      driveTitle,
      folderId,
      (pct) => onUpdate({ progress: pct })
    );

    // Share with service account
    const saEmail = import.meta.env.VITE_SERVICE_ACCOUNT_EMAIL;
    if (saEmail) {
      try {
        await shareWithServiceAccount(accessToken, driveFileId, saEmail);
      } catch (err) {
        console.warn('Could not share with service account:', err.message);
      }
    }

    // Write to Firestore
    await addDoc(collection(db, 'books'), {
      title: meta.title.trim(),
      author: meta.author.trim(),
      genre: meta.genre || '',
      language: meta.language || 'es',
      description: (meta.description || '').trim(),
      coverUrl: (meta.coverUrl && !meta.coverUrl.startsWith('blob:')) ? meta.coverUrl : '',
      driveFileId,
      driveOwnerUid: uid,
      fileHash,
      isbn: meta.isbn || null,
      bookGroupId: null,
      uploadedBy: {
        uid,
        displayName: profile.displayName,
        email: profile.email,
      },
      uploadedAt: serverTimestamp(),
      ratingSum: 0,
      ratingCount: 0,
    });

    onUpdate({ status: 'done', progress: 100 });
    return 'done';
  } catch (err) {
    onUpdate({ status: 'error', error: err.message });
    return 'error';
  }
}
