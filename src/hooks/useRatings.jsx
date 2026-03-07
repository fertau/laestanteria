import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useRatings(bookId) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [myRating, setMyRating] = useState(null); // null = not rated, 1-5
  const [loading, setLoading] = useState(true);

  // Load my rating for this book
  useEffect(() => {
    if (!bookId || !uid) {
      setMyRating(null);
      setLoading(false);
      return;
    }

    (async () => {
      const snap = await getDoc(doc(db, 'ratings', bookId, 'reviews', uid));
      if (snap.exists()) {
        setMyRating(snap.data().rating);
      } else {
        setMyRating(null);
      }
      setLoading(false);
    })();
  }, [bookId, uid]);

  // Rate a book (atomic transaction)
  const rate = useCallback(
    async (newRating) => {
      if (!bookId || !uid) return;

      const reviewRef = doc(db, 'ratings', bookId, 'reviews', uid);
      const bookRef = doc(db, 'books', bookId);

      await runTransaction(db, async (transaction) => {
        const reviewSnap = await transaction.get(reviewRef);
        const bookSnap = await transaction.get(bookRef);

        if (!bookSnap.exists()) throw new Error('Libro no encontrado');

        const bookData = bookSnap.data();
        let { ratingSum = 0, ratingCount = 0 } = bookData;

        if (reviewSnap.exists()) {
          // Update existing rating
          const oldRating = reviewSnap.data().rating;
          ratingSum = ratingSum - oldRating + newRating;
        } else {
          // New rating
          ratingSum += newRating;
          ratingCount += 1;
        }

        transaction.set(reviewRef, {
          rating: newRating,
          updatedAt: serverTimestamp(),
        });

        transaction.update(bookRef, { ratingSum, ratingCount });
      });

      setMyRating(newRating);
    },
    [bookId, uid]
  );

  // Remove rating
  const removeRating = useCallback(
    async () => {
      if (!bookId || !uid || myRating === null) return;

      const reviewRef = doc(db, 'ratings', bookId, 'reviews', uid);
      const bookRef = doc(db, 'books', bookId);

      await runTransaction(db, async (transaction) => {
        const reviewSnap = await transaction.get(reviewRef);
        const bookSnap = await transaction.get(bookRef);

        if (!bookSnap.exists() || !reviewSnap.exists()) return;

        const bookData = bookSnap.data();
        const oldRating = reviewSnap.data().rating;

        transaction.delete(reviewRef);
        transaction.update(bookRef, {
          ratingSum: (bookData.ratingSum || 0) - oldRating,
          ratingCount: Math.max(0, (bookData.ratingCount || 0) - 1),
        });
      });

      setMyRating(null);
    },
    [bookId, uid, myRating]
  );

  return { myRating, loading, rate, removeRating };
}
