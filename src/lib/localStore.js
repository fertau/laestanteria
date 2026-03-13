/**
 * Local EPUB storage using OPFS (Origin Private File System) with IndexedDB fallback.
 *
 * EPUBs are stored locally on the user's device and never uploaded to cloud storage.
 * Files are keyed by their SHA-256 hash for deduplication.
 */

const DB_NAME = 'laestanteria-epubs';
const DB_VERSION = 1;
const STORE_NAME = 'files';

// ---------------------------------------------------------------------------
// OPFS (preferred — faster, no size limits from browser quota prompts)
// ---------------------------------------------------------------------------

async function hasOPFS() {
  try {
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

async function opfsSave(hash, file) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('epubs', { create: true });
  const fileHandle = await dir.getFileHandle(hash, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

async function opfsGet(hash) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('epubs');
    const fileHandle = await dir.getFileHandle(hash);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

async function opfsDelete(hash) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('epubs');
    await dir.removeEntry(hash);
  } catch {
    // File didn't exist — that's fine
  }
}

async function opfsHas(hash) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('epubs');
    await dir.getFileHandle(hash);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB fallback
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(hash, file) {
  const idb = await openDB();
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(buffer, hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(hash) {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(hash);
    req.onsuccess = () => {
      if (req.result) {
        resolve(new File([req.result], `${hash}.epub`, { type: 'application/epub+zip' }));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(hash) {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbHas(hash) {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count(hash);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Public API — auto-selects OPFS or IndexedDB
// ---------------------------------------------------------------------------

let _useOPFS = null;

async function shouldUseOPFS() {
  if (_useOPFS === null) {
    _useOPFS = await hasOPFS();
  }
  return _useOPFS;
}

/**
 * Save an EPUB file locally, keyed by its SHA-256 hash.
 * @param {string} hash - SHA-256 hex string
 * @param {File|Blob} file - The EPUB file
 */
export async function saveEpub(hash, file) {
  if (await shouldUseOPFS()) {
    await opfsSave(hash, file);
  } else {
    await idbSave(hash, file);
  }
}

/**
 * Retrieve a locally stored EPUB by hash.
 * Checks OPFS/IndexedDB first, then falls back to the library folder
 * (File System Access API) if available.
 * @param {string} hash - SHA-256 hex string
 * @returns {File|null}
 */
export async function getEpub(hash) {
  // 1. Try existing browser storage (fast, no permission needed)
  let file;
  if (await shouldUseOPFS()) {
    file = await opfsGet(hash);
  } else {
    file = await idbGet(hash);
  }
  if (file) return file;

  // 2. Fallback: library folder (lazy import to avoid breaking unsupported browsers)
  try {
    const { isLibraryFolderSupported, getEpubFromLibrary } = await import('./libraryFolder.js');
    if (isLibraryFolderSupported()) {
      return await getEpubFromLibrary(hash);
    }
  } catch {
    // Library folder not available — that's fine
  }

  return null;
}

/**
 * Delete a locally stored EPUB.
 * @param {string} hash - SHA-256 hex string
 */
export async function deleteEpub(hash) {
  if (await shouldUseOPFS()) {
    await opfsDelete(hash);
  } else {
    await idbDelete(hash);
  }
}

/**
 * Check if an EPUB exists locally or in the library folder.
 * @param {string} hash - SHA-256 hex string
 * @returns {boolean}
 */
export async function hasEpub(hash) {
  // 1. Check browser storage first
  let exists;
  if (await shouldUseOPFS()) {
    exists = await opfsHas(hash);
  } else {
    exists = await idbHas(hash);
  }
  if (exists) return true;

  // 2. Fallback: check library folder index
  try {
    const { isLibraryFolderSupported, hasEpubInLibrary } = await import('./libraryFolder.js');
    if (isLibraryFolderSupported()) {
      return await hasEpubInLibrary(hash);
    }
  } catch {
    // Library folder not available — that's fine
  }

  return false;
}
