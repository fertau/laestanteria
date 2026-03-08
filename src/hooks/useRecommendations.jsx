import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useRecommendations() {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);

  // Listen to sent recommendations
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(
      collection(db, 'recommendations'),
      where('fromUid', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setSent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [uid, profile]);

  // Listen to received recommendations
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(
      collection(db, 'recommendations'),
      where('toUid', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setReceived(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid, profile]);

  const unreadCount = received.filter((r) => !r.readAt).length;

  // Send a recommendation
  const sendRecommendation = useCallback(
    async (bookId, bookTitle, bookAuthor, toUid, toName, message = '') => {
      if (!uid || !profile) return;

      await addDoc(collection(db, 'recommendations'), {
        fromUid: uid,
        fromName: profile.displayName,
        toUid,
        toName,
        bookId,
        bookTitle,
        bookAuthor,
        message,
        readAt: null,
        createdAt: serverTimestamp(),
      });
    },
    [uid, profile],
  );

  // Mark as read
  const markAsRead = useCallback(async (recId) => {
    await updateDoc(doc(db, 'recommendations', recId), {
      readAt: serverTimestamp(),
    });
  }, []);

  return {
    sent,
    received,
    unreadCount,
    loading,
    sendRecommendation,
    markAsRead,
  };
}
