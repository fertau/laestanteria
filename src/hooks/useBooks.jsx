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

  return {
    books: allBooks,
    loading,
    uploadBook,
    updateBook,
    deleteBook,
    deleteBooks,
    hasFollows: libraryFollowingUids.length > 0 || bondedUids.length > 0,
  };
}
