/**
 * Library Folder — File System Access API integration.
 *
 * Lets users designate a local directory as their "library folder".
 * The app reads EPUBs directly from that folder, indexed by SHA-256 hash.
 * If browser storage is cleared, re-selecting the folder auto-reconnects
 * all books via hash matching against Firestore records.
 *
 * Only works in Chromium browsers (Chrome, Edge, Brave).
 * Falls back gracefully — this module never throws on unsupported browsers.
 */

import { hashFile } from './hashUtils';

// ---------------------------------------------------------------------------
// IndexedDB: separate database for library folder data
// ---------------------------------------------------------------------------

const DB_NAME = 'laestanteria-library';
const DB_VERSION = 1;
const STORE_HANDLES = 'handles';
const STORE_INDEX = 'index';
const STORE_META = 'meta';

const HANDLE_KEY = 'libraryDir';
const META_KEY = 'library';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES);
      }
      if (!db.objectStoreNames.contains(STORE_INDEX)) {
        db.createObjectStore(STORE_INDEX);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store, key, value) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbGet(store, key) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbDelete(store, key) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbClear(store) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** Read all entries from a store as an array of { key, value } */
function idbGetAll(store) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const entries = [];
        const cursorReq = tx.objectStore(store).openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            entries.push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else {
            resolve(entries);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      })
  );
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Check if the File System Access API is available.
 * @returns {boolean}
 */
export function isLibraryFolderSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ---------------------------------------------------------------------------
// Handle management
// ---------------------------------------------------------------------------

/**
 * Open the native directory picker and store the selected handle.
 * Must be called from a user gesture (click handler).
 * @returns {Promise<{ handle: FileSystemDirectoryHandle, folderName: string }>}
 */
export async function selectLibraryFolder() {
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  await idbPut(STORE_HANDLES, HANDLE_KEY, handle);
  await idbPut(STORE_META, META_KEY, {
    folderName: handle.name,
    lastScanAt: null,
    fileCount: 0,
  });
  return { handle, folderName: handle.name };
}

/**
 * Retrieve the stored directory handle from IndexedDB.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export async function getStoredHandle() {
  try {
    return await idbGet(STORE_HANDLES, HANDLE_KEY);
  } catch {
    return null;
  }
}

/**
 * Verify (and optionally request) read permission on a handle.
 * @param {FileSystemDirectoryHandle} handle
 * @param {boolean} requestIfNeeded - If true, prompts the user (requires user gesture)
 * @returns {Promise<'granted'|'prompt'|'denied'>}
 */
export async function verifyPermission(handle, requestIfNeeded = false) {
  try {
    const opts = { mode: 'read' };
    let perm = await handle.queryPermission(opts);
    if (perm === 'granted') return 'granted';
    if (requestIfNeeded) {
      perm = await handle.requestPermission(opts);
    }
    return perm;
  } catch {
    return 'denied';
  }
}

/**
 * Remove the stored handle and clear all index data.
 */
export async function disconnectLibraryFolder() {
  try {
    await idbDelete(STORE_HANDLES, HANDLE_KEY);
    await idbClear(STORE_INDEX);
    await idbClear(STORE_META);
  } catch {
    // Best effort
  }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/**
 * Recursively find all .epub files in a directory.
 * @param {FileSystemDirectoryHandle} handle
 * @param {((progress: { found: number }) => void)|null} onProgress
 * @returns {Promise<Array<{ fileHandle: FileSystemFileHandle, relativePath: string }>>}
 */
export async function scanFolder(handle, onProgress = null) {
  const results = [];

  async function recurse(dirHandle, pathPrefix) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.epub')) {
        results.push({
          fileHandle: entry,
          relativePath: pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name,
        });
        if (onProgress && results.length % 10 === 0) {
          onProgress({ found: results.length });
        }
      } else if (entry.kind === 'directory') {
        // Skip hidden directories
        if (entry.name.startsWith('.')) continue;
        try {
          await recurse(entry, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name);
        } catch {
          // Permission denied or other error on subdirectory — skip
        }
      }
    }
  }

  await recurse(handle, '');
  if (onProgress) onProgress({ found: results.length });
  return results;
}

/**
 * Scan folder and build/update the hash index in IndexedDB.
 * Optimized: skips re-hashing files whose size+lastModified haven't changed.
 *
 * @param {FileSystemDirectoryHandle} handle
 * @param {((progress: { total: number, processed: number, hashed: number, skipped: number }) => void)|null} onProgress
 */
export async function buildIndex(handle, onProgress = null) {
  // 1. Scan for all EPUB files
  const files = await scanFolder(handle, null);
  const total = files.length;

  // 2. Load existing index for optimization
  const existingEntries = await idbGetAll(STORE_INDEX);
  const existingByPath = new Map();
  for (const { key, value } of existingEntries) {
    existingByPath.set(value.relativePath, { hash: key, ...value });
  }

  // 3. Process each file
  const db = await openDB();
  let processed = 0;
  let hashed = 0;
  let skipped = 0;
  let fileCount = 0;

  // Batch writes for performance
  for (const { fileHandle, relativePath } of files) {
    try {
      const file = await fileHandle.getFile();
      const existing = existingByPath.get(relativePath);

      let hash;
      if (existing && existing.size === file.size && existing.lastModified === file.lastModified) {
        // File unchanged — reuse existing hash
        hash = existing.hash;
        skipped++;
      } else {
        // New or changed file — compute hash
        hash = await hashFile(file);
        hashed++;
      }

      // Write to index
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_INDEX, 'readwrite');
        tx.objectStore(STORE_INDEX).put(
          { relativePath, size: file.size, lastModified: file.lastModified },
          hash
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      fileCount++;
    } catch {
      // Skip files that can't be read
    }

    processed++;
    if (onProgress && (processed % 5 === 0 || processed === total)) {
      onProgress({ total, processed, hashed, skipped });
    }
  }

  // 4. Update meta
  await idbPut(STORE_META, META_KEY, {
    folderName: handle.name,
    lastScanAt: Date.now(),
    fileCount,
  });

  if (onProgress) onProgress({ total, processed, hashed, skipped });
}

// ---------------------------------------------------------------------------
// File access
// ---------------------------------------------------------------------------

/**
 * Navigate a directory handle to a file by relative path.
 * @param {FileSystemDirectoryHandle} rootHandle
 * @param {string} relativePath - e.g. "Author/Book Title/book.epub"
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function getFileHandleByPath(rootHandle, relativePath) {
  try {
    const segments = relativePath.split('/');
    const fileName = segments.pop();
    let current = rootHandle;
    for (const dir of segments) {
      current = await current.getDirectoryHandle(dir);
    }
    return await current.getFileHandle(fileName);
  } catch {
    return null;
  }
}

/**
 * Get an EPUB file from the library folder by its SHA-256 hash.
 * @param {string} hash
 * @returns {Promise<File|null>}
 */
export async function getEpubFromLibrary(hash) {
  try {
    const handle = await getStoredHandle();
    if (!handle) return null;

    // Silent permission check — no user gesture, so can't prompt
    const perm = await verifyPermission(handle, false);
    if (perm !== 'granted') return null;

    // Look up in index
    const entry = await idbGet(STORE_INDEX, hash);
    if (!entry) return null;

    // Navigate to file
    const fileHandle = await getFileHandleByPath(handle, entry.relativePath);
    if (!fileHandle) return null;

    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Check if a hash exists in the library folder index (fast, no file I/O).
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function hasEpubInLibrary(hash) {
  try {
    const entry = await idbGet(STORE_INDEX, hash);
    return entry !== null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Stats & queries
// ---------------------------------------------------------------------------

/**
 * Get current library folder status and stats.
 * @returns {Promise<{ connected: boolean, folderName: string|null, fileCount: number, lastScanAt: number|null }>}
 */
export async function getLibraryStats() {
  try {
    const handle = await getStoredHandle();
    if (!handle) {
      return { connected: false, folderName: null, fileCount: 0, lastScanAt: null };
    }
    const meta = await idbGet(STORE_META, META_KEY);
    return {
      connected: true,
      folderName: meta?.folderName || handle.name,
      fileCount: meta?.fileCount || 0,
      lastScanAt: meta?.lastScanAt || null,
    };
  } catch {
    return { connected: false, folderName: null, fileCount: 0, lastScanAt: null };
  }
}

/**
 * Get all indexed EPUBs whose hash is NOT in the given set.
 * Used by ImportModal to find books not yet imported to Firestore.
 *
 * @param {Set<string>} existingHashes - hashes already in Firestore
 * @returns {Promise<Array<{ hash: string, relativePath: string }>>}
 */
export async function getNewEpubs(existingHashes) {
  try {
    const entries = await idbGetAll(STORE_INDEX);
    return entries
      .filter(({ key }) => !existingHashes.has(key))
      .map(({ key, value }) => ({ hash: key, relativePath: value.relativePath }));
  } catch {
    return [];
  }
}
