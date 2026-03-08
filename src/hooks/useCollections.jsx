import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useCollections() {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Listen to all collections (visible to all registered users)
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(collection(db, 'collections'));
    return onSnapshot(q, (snap) => {
      setCollections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [uid, profile]);

  // Create a new collection
  const createCollection = useCallback(
    async (name, description = '') => {
      if (!uid || !profile) return;

      const docRef = await addDoc(collection(db, 'collections'), {
        name,
        description,
        bookIds: [],
        createdBy: {
          uid,
          displayName: profile.displayName,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [uid, profile],
  );

  // Update collection metadata
  const updateCollection = useCallback(async (collectionId, updates) => {
    await updateDoc(doc(db, 'collections', collectionId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, []);

  // Delete a collection (only owner)
  const deleteCollection = useCallback(async (collectionId) => {
    await deleteDoc(doc(db, 'collections', collectionId));
  }, []);

  // Add a book to a collection
  const addBookToCollection = useCallback(async (collectionId, bookId) => {
    await updateDoc(doc(db, 'collections', collectionId), {
      bookIds: arrayUnion(bookId),
      updatedAt: serverTimestamp(),
    });
  }, []);

  // Remove a book from a collection
  const removeBookFromCollection = useCallback(async (collectionId, bookId) => {
    await updateDoc(doc(db, 'collections', collectionId), {
      bookIds: arrayRemove(bookId),
      updatedAt: serverTimestamp(),
    });
  }, []);

  return {
    collections,
    loading,
    createCollection,
    updateCollection,
    deleteCollection,
    addBookToCollection,
    removeBookFromCollection,
  };
}
