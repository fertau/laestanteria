/**
 * Batch metadata update queue engine.
 * Pure functions with no React state — communicates via callbacks.
 * Modeled after importQueue.js.
 */

import { enrichMetadataStandalone } from './importQueue';
import { searchCovers as gbSearchCovers } from './googleBooks';
import { searchCovers as olSearchCovers } from './openLibrary';

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
    searchResults: null,
    coverOptions: [],
    diff: {},
  };
}

/**
 * Process a single batch item: search APIs for better metadata + covers.
 * @param {BatchQueueItem} item
 * @param {(update: Partial<BatchQueueItem>) => void} onUpdate
 */
export async function processBatchItem(item, onUpdate) {
  const { book } = item;

  try {
    // Phase 1: Search metadata
    onUpdate({ status: 'searching' });

    let searchResults = {};
    try {
      searchResults = await enrichMetadataStandalone({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || '',
      });
    } catch {
      // Metadata search failed, continue to covers
    }

    onUpdate({ searchResults });

    // Phase 2: Search covers
    onUpdate({ status: 'covers' });
    let coverOptions = [];
    try {
      const [gbC, olC] = await Promise.allSettled([
        gbSearchCovers(book.title || '', book.author || '', book.isbn || ''),
        olSearchCovers(book.title || '', book.author || '', book.isbn || ''),
      ]);

      const allCovers = [
        ...(gbC.status === 'fulfilled' ? gbC.value : []),
        ...(olC.status === 'fulfilled' ? olC.value : []),
      ];

      const seen = new Set();
      coverOptions = allCovers.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });
    } catch {
      // Cover search failed
    }

    onUpdate({ coverOptions });

    // Phase 3: Build diff (only propose filling empty fields)
    const diff = {};
    const fields = ['title', 'author', 'genre', 'language', 'description', 'isbn'];

    for (const field of fields) {
      const oldVal = (book[field] || '').trim();
      let newVal = (searchResults[field] || '').trim();

      // Map genre through our standard list
      if (field === 'genre' && newVal) {
        newVal = mapGenre(newVal) || '';
      }

      // Only propose if old is empty and new has a value
      if (!oldVal && newVal) {
        diff[field] = { old: oldVal, new: newVal, accepted: true };
      }
    }

    // Cover diff: propose if missing or blob:
    const oldCover = (book.coverUrl || '').trim();
    const bestCover = searchResults?.coverUrl || (coverOptions.length > 0 ? coverOptions[0].url : '');

    if (bestCover && (!oldCover || oldCover.startsWith('blob:'))) {
      diff.coverUrl = { old: oldCover, new: bestCover, accepted: true };
    }

    const hasChanges = Object.keys(diff).length > 0;
    onUpdate({
      diff,
      status: hasChanges ? 'ready' : 'unchanged',
    });
  } catch (err) {
    onUpdate({ status: 'error', error: err.message });
  }
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
