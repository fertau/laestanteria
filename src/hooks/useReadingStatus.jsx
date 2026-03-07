import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

/**
 * Reading status per book: 'want' | 'reading' | 'finished' | null
 * Stored at /readingStatus/{uid}/books/{bookId}
 */

// Hook for a single book's reading status
export function useReadingStatus(bookId) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId || !uid) {
      setStatus(null);
      setLoading(false);
      return;
    }

    (async () => {
      const snap = await getDoc(doc(db, 'readingStatus', uid, 'books', bookId));
      if (snap.exists()) {
        setStatus(snap.data().status);
      } else {
        setStatus(null);
      }
      setLoading(false);
    })();
  }, [bookId, uid]);

  const setReadingStatus = useCallback(
    async (newStatus) => {
      if (!bookId || !uid) return;

      const ref = doc(db, 'readingStatus', uid, 'books', bookId);

      if (!newStatus) {
        await deleteDoc(ref);
        setStatus(null);
      } else {
        await setDoc(ref, {
          status: newStatus,
          bookId,
          updatedAt: serverTimestamp(),
        });
        setStatus(newStatus);
      }
    },
    [bookId, uid]
  );

  return { status, loading, setReadingStatus };
}

// Hook for all reading statuses of the current user (for stats/profile)
export function useAllReadingStatuses() {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !profile) {
      setStatuses([]);
      setLoading(false);
      return;
    }

    return onSnapshot(
      collection(db, 'readingStatus', uid, 'books'),
      (snap) => {
        setStatuses(snap.docs.map((d) => ({ bookId: d.id, ...d.data() })));
        setLoading(false);
      }
    );
  }, [uid, profile]);

  const wantToRead = statuses.filter((s) => s.status === 'want');
  const reading = statuses.filter((s) => s.status === 'reading');
  const finished = statuses.filter((s) => s.status === 'finished');

  return { statuses, wantToRead, reading, finished, loading };
}
