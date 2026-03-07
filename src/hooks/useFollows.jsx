import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

const FollowsContext = createContext(null);

export function FollowsProvider({ children }) {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const [outgoing, setOutgoing] = useState([]); // where I am follower
  const [incoming, setIncoming] = useState([]); // where I am followed

  // Listen to follows where I am the follower
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(collection(db, 'follows'), where('followerUid', '==', uid));
    return onSnapshot(q, (snap) => {
      setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid, profile]);

  // Listen to follows where I am the followed
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(collection(db, 'follows'), where('followingUid', '==', uid));
    return onSnapshot(q, (snap) => {
      setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid, profile]);

  // Derived data
  const following = useMemo(
    () => outgoing.filter((f) => f.status === 'accepted'),
    [outgoing]
  );

  const followers = useMemo(
    () => incoming.filter((f) => f.status === 'accepted'),
    [incoming]
  );

  const pendingOut = useMemo(
    () => outgoing.filter((f) => f.status === 'pending'),
    [outgoing]
  );

  const pendingIn = useMemo(
    () => incoming.filter((f) => f.status === 'pending'),
    [incoming]
  );

  // UIDs of users I follow with library access (can download their books)
  const libraryFollowingUids = useMemo(
    () => following.filter((f) => f.accessLevel === 'library').map((f) => f.followingUid),
    [following]
  );

  // UIDs of all accepted follows (for activity feed)
  const activityFollowingUids = useMemo(
    () => following.map((f) => f.followingUid),
    [following]
  );

  // Get the follow relationship status with a specific user
  const getFollowStatus = useCallback(
    (targetUid) => {
      const existing = outgoing.find((f) => f.followingUid === targetUid);
      if (!existing) return { status: 'none', doc: null };
      return { status: existing.status, accessLevel: existing.accessLevel, doc: existing };
    },
    [outgoing]
  );

  // Request to follow someone
  const requestFollow = useCallback(
    async (targetUid, targetPrivacyMode) => {
      if (!uid) return;

      // Check for existing follow
      const existing = outgoing.find((f) => f.followingUid === targetUid);
      if (existing) return;

      const isOpen = targetPrivacyMode === 'open';
      await addDoc(collection(db, 'follows'), {
        followerUid: uid,
        followingUid: targetUid,
        status: isOpen ? 'accepted' : 'pending',
        accessLevel: isOpen ? 'activity' : 'activity',
        createdAt: serverTimestamp(),
        resolvedAt: isOpen ? serverTimestamp() : null,
      });
    },
    [uid, outgoing]
  );

  // Unfollow someone
  const unfollow = useCallback(
    async (targetUid) => {
      const existing = outgoing.find((f) => f.followingUid === targetUid);
      if (existing) {
        await deleteDoc(doc(db, 'follows', existing.id));
      }
    },
    [outgoing]
  );

  // Accept a follow request (with access level selection)
  const acceptFollow = useCallback(
    async (followId, accessLevel = 'activity') => {
      await updateDoc(doc(db, 'follows', followId), {
        status: 'accepted',
        accessLevel,
        resolvedAt: serverTimestamp(),
      });
    },
    []
  );

  // Reject a follow request
  const rejectFollow = useCallback(
    async (followId) => {
      await deleteDoc(doc(db, 'follows', followId));
    },
    []
  );

  // Change access level of an existing follow
  const changeAccessLevel = useCallback(
    async (followId, newLevel) => {
      await updateDoc(doc(db, 'follows', followId), {
        accessLevel: newLevel,
      });
    },
    []
  );

  // Remove a follower
  const removeFollower = useCallback(
    async (followId) => {
      await deleteDoc(doc(db, 'follows', followId));
    },
    []
  );

  // Request upgrade from activity to library
  const requestUpgrade = useCallback(
    async (targetUid) => {
      const existing = outgoing.find(
        (f) => f.followingUid === targetUid && f.status === 'accepted' && f.accessLevel === 'activity'
      );
      if (existing) {
        await updateDoc(doc(db, 'follows', existing.id), {
          status: 'pending',
          accessLevel: 'library',
        });
      }
    },
    [outgoing]
  );

  // Auto-accept pending follows when privacyMode changes to 'open'
  const autoAcceptPending = useCallback(async () => {
    const pending = incoming.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;

    const batch = writeBatch(db);
    pending.forEach((f) => {
      batch.update(doc(db, 'follows', f.id), {
        status: 'accepted',
        accessLevel: 'activity',
        resolvedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }, [incoming]);

  // Check if I can download books from a specific user
  const canDownloadFrom = useCallback(
    (uploaderUid) => {
      if (uploaderUid === uid) return true;
      return libraryFollowingUids.includes(uploaderUid);
    },
    [uid, libraryFollowingUids]
  );

  const value = {
    following,
    followers,
    pendingOut,
    pendingIn,
    libraryFollowingUids,
    activityFollowingUids,
    getFollowStatus,
    requestFollow,
    unfollow,
    acceptFollow,
    rejectFollow,
    changeAccessLevel,
    removeFollower,
    requestUpgrade,
    autoAcceptPending,
    canDownloadFrom,
  };

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows() {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error('useFollows must be used within FollowsProvider');
  return ctx;
}
