import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useFollows } from './useFollows';
import { useBonds } from './useBonds';
import { saveEpub, deleteEpub } from '../lib/localStore';

export function useBooks() {
  const { user, profile } = useAuth();
  const { libraryFollowingUids } = useFollows();
  const { bondedUids } = useBonds();
  const uid = user?.uid;

  const [allBooks, setAllBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Build the list of UIDs whose books I can see:
  // myself + library follows (legacy) + bonded users
  const visibleUids = useMemo(() => {
    if (!uid) return [];
    const uids = new Set([uid, ...libraryFollowingUids, ...bondedUids]);
    return [...uids];
  }, [uid, libraryFollowingUids, bondedUids]);

  // Listen to books from visible users
  // Firestore 'in' supports up to 30 values — sufficient for small group
  useEffect(() => {
    if (!uid || visibleUids.length === 0) {
      setAllBooks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'books'),
      where('uploadedBy.uid', 'in', visibleUids)
    );

    return onSnapshot(q, (snap) => {
      setAllBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [uid, visibleUids]);

  // Upload a book — saves EPUB locally (OPFS/IndexedDB) and metadata to Firestore
  const uploadBook = useCallback(
    async (file, metadata, onProgress) => {
      if (!uid || !profile) throw new Error('No autenticado');

      // 1. Save EPUB to local storage (OPFS or IndexedDB)
      if (onProgress) onProgress(10);
      await saveEpub(metadata.fileHash, file);
      if (onProgress) onProgress(50);

      // 2. Write metadata to Firestore
      const bookDoc = await addDoc(collection(db, 'books'), {
        title: metadata.title,
        author: metadata.author,
        genre: metadata.genre || '',
        language: metadata.language || 'es',
        description: metadata.description || '',
        coverUrl: metadata.coverUrl || '',
        fileHash: metadata.fileHash,
        isbn: metadata.isbn || null,
        bookGroupId: metadata.bookGroupId || null,
        uploadedBy: {
          uid,
          displayName: profile.displayName,
          email: profile.email,
        },
        uploadedAt: serverTimestamp(),
        ratingSum: 0,
        ratingCount: 0,
      });

      if (onProgress) onProgress(100);
      return bookDoc.id;
    },
    [uid, profile]
  );

  // Update a book's metadata (only the uploader — enforced client-side)
  const updateBook = useCallback(
    async (bookId, updates) => {
      await updateDoc(doc(db, 'books', bookId), updates);
    },
    []
  );

  // Delete a book (only the uploader) — also removes local EPUB
  const deleteBook = useCallback(
    async (bookId) => {
      const book = allBooks.find((b) => b.id === bookId);
      if (book?.fileHash) {
        try { await deleteEpub(book.fileHash); } catch { /* ignore */ }
      }
      await deleteDoc(doc(db, 'books', bookId));
    },
    [allBooks]
  );

  // Bulk delete books (atomic via writeBatch, up to 500 per batch)
  const deleteBooks = useCallback(
    async (bookIds) => {
      if (!bookIds || bookIds.length === 0) return;
      const batchSize = 500;
      for (let i = 0; i < bookIds.length; i += batchSize) {
        const chunk = bookIds.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => batch.delete(doc(db, 'books', id)));
        await batch.commit();
      }
    },
    []
  );

  // Group books for multi-language display.
  // Two grouping strategies (merged):
  // 1. Explicit bookGroupId (set manually or via batch)
  // 2. Auto-detect: same normalized title+author, different languages
  const groupedBooks = useMemo(() => {
    // Normalize for matching: lowercase, remove accents, collapse whitespace
    const normalize = (s) =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

    const groups = new Map(); // groupKey → Book[]
    const bookToGroup = new Map(); // book.id → groupKey

    // Pass 1: explicit bookGroupId
    for (const book of allBooks) {
      if (book.bookGroupId) {
        const key = `explicit:${book.bookGroupId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(book);
        bookToGroup.set(book.id, key);
      }
    }

    // Pass 2: auto-detect by normalized title+author (only for ungrouped books)
    for (const book of allBooks) {
      if (bookToGroup.has(book.id)) continue;
      const titleNorm = normalize(book.title);
      const authorNorm = normalize(book.author);
      if (!titleNorm || !authorNorm) continue;
      const key = `auto:${titleNorm}::${authorNorm}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(book);
      bookToGroup.set(book.id, key);
    }

    // Pass 3: truly ungrouped (no title or author)
    const ungrouped = allBooks.filter((b) => !bookToGroup.has(b.id));

    // Build result
    const result = [...ungrouped];
    const seen = new Set();

    for (const [groupKey, variants] of groups) {
      // Deduplicate: same language = real duplicate, keep; different language = group
      const uniqueLangs = new Set(variants.map((v) => v.language).filter(Boolean));
      if (variants.length === 1 || uniqueLangs.size <= 1) {
        // Not a multi-language group — add individually
        for (const v of variants) {
          if (!seen.has(v.id)) {
            result.push(v);
            seen.add(v.id);
          }
        }
      } else {
        // Multi-language group — merge into one card
        variants.sort((a, b) => {
          const aOwn = a.uploadedBy?.uid === uid ? 1 : 0;
          const bOwn = b.uploadedBy?.uid === uid ? 1 : 0;
          if (bOwn !== aOwn) return bOwn - aOwn;
          return (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0);
        });
        const primary = variants[0];
        result.push({
          ...primary,
          _isGroup: true,
          _groupId: groupKey,
          _variants: variants,
          _languages: [...uniqueLangs],
        });
        for (const v of variants) seen.add(v.id);
      }
    }

    return result;
  }, [allBooks, uid]);

  return {
    books: allBooks,
    groupedBooks,
    loading,
    uploadBook,
    updateBook,
    deleteBook,
    deleteBooks,
    hasFollows: libraryFollowingUids.length > 0 || bondedUids.length > 0,
  };
}
