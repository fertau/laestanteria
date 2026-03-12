import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from './useAuth';
import { getEpub } from '../lib/localStore';

export function useRequests() {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const [outgoing, setOutgoing] = useState([]); // requests I made
  const [incoming, setIncoming] = useState([]); // requests made to me

  // Listen to requests I sent
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'requests'), where('fromUid', '==', uid));
    return onSnapshot(q, (snap) => {
      setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid]);

  // Listen to requests sent to me
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'requests'), where('toUid', '==', uid));
    return onSnapshot(q, (snap) => {
      setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid]);

  const pendingIncoming = useMemo(
    () => incoming.filter((r) => r.status === 'pending'),
    [incoming]
  );

  // Create a request for books
  const requestBooks = useCallback(
    async (toUid, toName, books) => {
      if (!uid || !profile) return;
      await addDoc(collection(db, 'requests'), {
        fromUid: uid,
        fromName: profile.displayName,
        toUid,
        toName,
        books: books.map((b) => ({
          bookId: b.id,
          title: b.title,
          author: b.author,
          fileHash: b.fileHash || null,
          status: 'pending',
          sentAt: null,
        })),
        status: 'pending',
        createdAt: serverTimestamp(),
        resolvedAt: null,
      });
    },
    [uid, profile]
  );

  // Approve and send specific books from a request to the requester's Kindle
  const approveAndSend = useCallback(
    async (requestId, bookIds, kindleEmail) => {
      const request = incoming.find((r) => r.id === requestId);
      if (!request) throw new Error('Request not found');

      const sendToKindleFn = httpsCallable(functions, 'sendToKindle');
      const updatedBooks = [...request.books];

      for (const bookId of bookIds) {
        const bookIdx = updatedBooks.findIndex((b) => b.bookId === bookId);
        if (bookIdx === -1) continue;

        const bookEntry = updatedBooks[bookIdx];
        if (!bookEntry.fileHash) {
          updatedBooks[bookIdx] = { ...bookEntry, status: 'failed' };
          continue;
        }

        // Get EPUB from local storage
        const file = await getEpub(bookEntry.fileHash);
        if (!file) {
          updatedBooks[bookIdx] = { ...bookEntry, status: 'failed' };
          continue;
        }

        try {
          // Convert file to base64 for Cloud Function
          const buffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          await sendToKindleFn({
            kindleEmail,
            bookTitle: bookEntry.title,
            bookAuthor: bookEntry.author,
            epubBase64: base64,
          });

          updatedBooks[bookIdx] = {
            ...bookEntry,
            status: 'sent',
            sentAt: new Date().toISOString(),
          };
        } catch (err) {
          console.error(`Failed to send ${bookEntry.title}:`, err);
          updatedBooks[bookIdx] = { ...bookEntry, status: 'failed' };
        }
      }

      // Determine overall request status
      const allResolved = updatedBooks.every((b) => b.status !== 'pending');
      const anySent = updatedBooks.some((b) => b.status === 'sent');
      const overallStatus = allResolved ? 'completed' : anySent ? 'partial' : 'pending';

      await updateDoc(doc(db, 'requests', requestId), {
        books: updatedBooks,
        status: overallStatus,
        resolvedAt: allResolved ? serverTimestamp() : null,
      });
    },
    [incoming]
  );

  // Reject specific books from a request
  const rejectBooks = useCallback(
    async (requestId, bookIds) => {
      const request = incoming.find((r) => r.id === requestId);
      if (!request) return;

      const updatedBooks = request.books.map((b) =>
        bookIds.includes(b.bookId) ? { ...b, status: 'rejected' } : b
      );

      const allResolved = updatedBooks.every((b) => b.status !== 'pending');

      await updateDoc(doc(db, 'requests', requestId), {
        books: updatedBooks,
        status: allResolved ? 'completed' : 'partial',
        resolvedAt: allResolved ? serverTimestamp() : null,
      });
    },
    [incoming]
  );

  return {
    outgoing,
    incoming,
    pendingIncoming,
    requestBooks,
    approveAndSend,
    rejectBooks,
  };
}
