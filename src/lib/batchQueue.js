/**
 * Batch metadata update queue engine v2.
 * Plex/BookLore-style: returns multiple candidates per book,
 * user selects the correct match, diff built from selection.
 *
 * Pure functions with no React state — communicates via callbacks.
 */

import { searchMultiple as gbSearchMultiple, searchCovers as gbSearchCovers } from './googleBooks';
import { searchMultiple as olSearchMultiple, searchCovers as olSearchCovers } from './openLibrary';
import { searchMultiple as hcSearchMultiple, searchCovers as hcSearchCovers } from './hardcover';

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

/**
 * Normalize a string for dedup: lowercase, strip punctuation, collapse spaces.
 * Avoids false duplicates like "El Hobbit" vs "El hobbit" or "J.R.R. Tolkien" vs "JRR Tolkien".
 */
function normalizeForDedup(str) {
  return str.toLowerCase().replace(/[^\w\s|]/g, '').replace(/\s+/g, ' ').trim();
}

function mapGenre(genreStr) {
  if (!genreStr) return '';
  for (const [regex, mapped] of GENRE_MAP) {
    if (regex.test(genreStr)) return mapped;
  }
  return '';
}

/** Count non-empty metadata fields for completeness ranking (BookLore pattern). */
function completenessScore(candidate) {
  return [candidate.title, candidate.author, candidate.description,
    candidate.coverUrl, candidate.genre, candidate.isbn, candidate.language]
    .filter(Boolean).length;
}

/**
 * Search both APIs and return deduplicated, ranked candidate array.
 * @param {string} title
 * @param {string} author
 * @param {string} isbn
 * @returns {Promise<Array<object>>}
 */
export async function searchCandidates(title, author, isbn) {
  const [gbResults, olResults, hcResults] = await Promise.allSettled([
    gbSearchMultiple(title, author, isbn),
    olSearchMultiple(title, author, isbn),
    hcSearchMultiple(title, author, isbn),
  ]);

  const gb = gbResults.status === 'fulfilled' ? gbResults.value : [];
  const ol = olResults.status === 'fulfilled' ? olResults.value : [];
  const hc = hcResults.status === 'fulfilled' ? hcResults.value : [];

  // 3-way interleave (show diversity from all sources)
  const interleaved = [];
  const maxLen = Math.max(gb.length, ol.length, hc.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < gb.length) interleaved.push(gb[i]);
    if (i < ol.length) interleaved.push(ol[i]);
    if (i < hc.length) interleaved.push(hc[i]);
  }

  // Deduplicate by normalized title+author (strips punctuation, case, extra spaces)
  const seen = new Set();
  const unique = interleaved.filter((c) => {
    const key = normalizeForDedup(`${c.title || ''}|${c.author || ''}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: ISBN matches first, then by completeness score
  unique.sort((a, b) => {
    const aIsbn = a.searchType === 'isbn' ? 1 : 0;
    const bIsbn = b.searchType === 'isbn' ? 1 : 0;
    if (bIsbn !== aIsbn) return bIsbn - aIsbn;
    return completenessScore(b) - completenessScore(a);
  });

  return unique.slice(0, 10);
}

/**
 * Build a batch queue item from an existing Firestore book document.
 * @param {Object} book - Book document with .id
 * @returns {BatchQueueItem}
 */
export function buildBatchItem(book) {
  return {
    id: book.id,
    book,
    status: 'pending',
    error: null,
    candidates: [],
    selectedCandidateIndex: -1,
    coverOptions: [],
    diff: {},
    fillEmptyOnly: true,
  };
}

/**
 * Build a field diff between a book and a selected candidate.
 * @param {Object} book - current book from Firestore
 * @param {Object} candidate - selected candidate metadata
 * @param {boolean} fillEmptyOnly - true = only fill blanks, false = propose all diffs
 * @returns {Object} diff: { field: { old, new, accepted } }
 */
export function buildDiffFromCandidate(book, candidate, fillEmptyOnly = true) {
  const diff = {};
  const fields = ['title', 'author', 'genre', 'language', 'description', 'isbn'];

  for (const field of fields) {
    const oldVal = (book[field] || '').trim();
    let newVal = (candidate[field] || '').trim();

    if (field === 'genre' && newVal) {
      newVal = mapGenre(newVal) || '';
    }

    if (!newVal) continue;

    if (fillEmptyOnly) {
      if (!oldVal) {
        diff[field] = { old: oldVal, new: newVal, accepted: true };
      }
    } else {
      if (oldVal !== newVal) {
        diff[field] = { old: oldVal, new: newVal, accepted: true };
      }
    }
  }

  // Cover diff
  const oldCover = (book.coverUrl || '').trim();
  const newCover = (candidate.coverUrl || '').trim();
  if (newCover) {
    if (fillEmptyOnly) {
      if (!oldCover || oldCover.startsWith('blob:')) {
        diff.coverUrl = { old: oldCover, new: newCover, accepted: true };
      }
    } else {
      if (oldCover !== newCover) {
        diff.coverUrl = { old: oldCover, new: newCover, accepted: true };
      }
    }
  }

  return diff;
}

/**
 * Process a single batch item: search APIs for candidates + covers.
 * @param {BatchQueueItem} item
 * @param {(update: Partial<BatchQueueItem>) => void} onUpdate
 */
export async function processBatchItem(item, onUpdate) {
  const { book } = item;

  try {
    // Phase 1: Search candidates
    onUpdate({ status: 'searching' });

    const searchTitle = item.customSearch?.title || book.title || '';
    const searchAuthor = item.customSearch?.author || book.author || '';
    const searchIsbn = item.customSearch?.isbn || book.isbn || '';

    let candidates = [];
    try {
      candidates = await searchCandidates(searchTitle, searchAuthor, searchIsbn);
    } catch { /* silently fail */ }

    onUpdate({ candidates });

    // Phase 2: Search covers (broader search for the cover gallery)
    onUpdate({ status: 'covers' });
    let coverOptions = [];
    try {
      const [gbC, olC, hcC] = await Promise.allSettled([
        gbSearchCovers(searchTitle, searchAuthor, searchIsbn),
        olSearchCovers(searchTitle, searchAuthor, searchIsbn),
        hcSearchCovers(searchTitle, searchAuthor, searchIsbn),
      ]);
      const allCovers = [
        ...(gbC.status === 'fulfilled' ? gbC.value : []),
        ...(olC.status === 'fulfilled' ? olC.value : []),
        ...(hcC.status === 'fulfilled' ? hcC.value : []),
      ];
      const seen = new Set();
      coverOptions = allCovers.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });
    } catch { /* silently fail */ }

    onUpdate({ coverOptions });

    // Phase 3: Auto-select first candidate and build diff
    let diff = {};
    let selectedCandidateIndex = -1;

    if (candidates.length > 0) {
      selectedCandidateIndex = 0;
      diff = buildDiffFromCandidate(book, candidates[0], item.fillEmptyOnly !== false);
    }

    const hasCandidates = candidates.length > 0;
    onUpdate({
      diff,
      selectedCandidateIndex,
      status: hasCandidates ? 'ready' : 'unchanged',
    });
  } catch (err) {
    onUpdate({ status: 'error', error: err.message });
  }
}

/**
 * Re-search a single batch item with custom search terms.
 * Used when user clicks "Otra búsqueda" in the review phase.
 * @param {BatchQueueItem} item
 * @param {{ title: string, author: string, isbn: string }} customSearch
 * @param {(update: Partial<BatchQueueItem>) => void} onUpdate
 */
export async function reSearchBatchItem(item, customSearch, onUpdate) {
  onUpdate({
    customSearch,
    candidates: [],
    selectedCandidateIndex: -1,
    coverOptions: [],
    diff: {},
    status: 'searching',
  });

  const modifiedItem = { ...item, customSearch };
  await processBatchItem(modifiedItem, onUpdate);
}

/**
 * Apply accepted changes for a single batch item.
 * @param {BatchQueueItem} item
 * @param {Function} updateBook - from useBooks hook
 * @param {(update: Partial<BatchQueueItem>) => void} onUpdate
 * @returns {Promise<boolean>} true if updated
 */
export async function applyBatchItem(item, updateBook, onUpdate) {
  const { diff } = item;
  if (!diff) return false;

  const updates = {};
  for (const [field, change] of Object.entries(diff)) {
    if (change.accepted) {
      updates[field] = change.new;
    }
  }

  if (Object.keys(updates).length === 0) return false;

  onUpdate({ status: 'saving' });
  try {
    await updateBook(item.id, updates);
    onUpdate({ status: 'done' });
    return true;
  } catch (err) {
    onUpdate({ status: 'error', error: err.message });
    return false;
  }
}
