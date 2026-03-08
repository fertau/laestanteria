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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useFollows } from './useFollows';
import {
  getOrCreateFolder,
  uploadEpubToDrive,
  shareWithServiceAccount,
} from '../lib/googleDrive';

export function useBooks() {
  const { user, profile, getAccessToken } = useAuth();
  const { libraryFollowingUids } = useFollows();
  const uid = user?.uid;

  const [allBooks, setAllBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Build the list of UIDs whose books I can see
  const visibleUids = useMemo(() => {
    if (!uid) return [];
    return [uid, ...libraryFollowingUids];
  }, [uid, libraryFollowingUids]);

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

  // Upload a book
  const uploadBook = useCallback(
    async (file, metadata, onProgress) => {
      if (!uid || !profile) throw new Error('No autenticado');

      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('No se pudo obtener acceso a Google Drive. Volve a iniciar sesion.');

      // 1. Get or create the folder
      const folderId = await getOrCreateFolder(accessToken);

      // 2. Upload to Drive
      const title = `${metadata.author} - ${metadata.title}`;
      const { driveFileId } = await uploadEpubToDrive(
        accessToken,
        file,
        title,
        folderId,
        onProgress
      );

      // 3. Share with service account (so Cloud Functions can access it)
      const saEmail = import.meta.env.VITE_SERVICE_ACCOUNT_EMAIL;
      if (saEmail) {
        try {
          await shareWithServiceAccount(accessToken, driveFileId, saEmail);
        } catch (err) {
          console.warn('Could not share with service account:', err.message);
        }
      }

      // 4. Write metadata to Firestore
      const bookDoc = await addDoc(collection(db, 'books'), {
        title: metadata.title,
        author: metadata.author,
        genre: metadata.genre || '',
        language: metadata.language || 'es',
        description: metadata.description || '',
        coverUrl: metadata.coverUrl || '',
        driveFileId,
        driveOwnerUid: uid,
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

      return bookDoc.id;
    },
    [uid, profile, getAccessToken]
  );

  // Update a book's metadata (only the uploader — enforced client-side)
  const updateBook = useCallback(
    async (bookId, updates) => {
      await updateDoc(doc(db, 'books', bookId), updates);
    },
    []
  );

  // Delete a book (only the uploader)
  const deleteBook = useCallback(
    async (bookId) => {
      await deleteDoc(doc(db, 'books', bookId));
    },
    []
  );

  return {
    books: allBooks,
    loading,
    uploadBook,
    updateBook,
    deleteBook,
    hasFollows: libraryFollowingUids.length > 0,
  };
}
