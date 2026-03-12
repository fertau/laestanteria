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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

const BondsContext = createContext(null);

/**
 * Bonds are bidirectional connections between two users that include
 * mutual Kindle email exchange. Both users must complete setup for
 * the bond to become active.
 *
 * Bond statuses:
 * - pending: initiated by one user, waiting for the other to accept
 * - active: both users have shared Kindle emails, bond is fully functional
 */
export function BondsProvider({ children }) {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const [bondsA, setBondsA] = useState([]);
  const [bondsB, setBondsB] = useState([]);

  // Listen to bonds where I am userA
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(collection(db, 'bonds'), where('userA', '==', uid));
    return onSnapshot(q, (snap) => {
      setBondsA(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid, profile]);

  // Listen to bonds where I am userB
  useEffect(() => {
    if (!uid || !profile) return;
    const q = query(collection(db, 'bonds'), where('userB', '==', uid));
    return onSnapshot(q, (snap) => {
      setBondsB(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid, profile]);

  // All bonds normalized: { id, peerUid, peerName, myKindleEmail, peerKindleEmail, status, ... }
  const bonds = useMemo(() => {
    const all = [];
    for (const b of bondsA) {
      all.push({
        id: b.id,
        peerUid: b.userB,
        peerName: b.userBName || '',
        myKindleEmail: b.kindleEmailA || '',
        peerKindleEmail: b.kindleEmailB || '',
        status: b.status,
        iAmInitiator: b.initiatedBy === uid,
        raw: b,
      });
    }
    for (const b of bondsB) {
      all.push({
        id: b.id,
        peerUid: b.userA,
        peerName: b.userAName || '',
        myKindleEmail: b.kindleEmailB || '',
        peerKindleEmail: b.kindleEmailA || '',
        status: b.status,
        iAmInitiator: b.initiatedBy === uid,
        raw: b,
      });
    }
    return all;
  }, [bondsA, bondsB, uid]);

  const activeBonds = useMemo(() => bonds.filter((b) => b.status === 'active'), [bonds]);
  const pendingBonds = useMemo(() => bonds.filter((b) => b.status === 'pending'), [bonds]);

  // UIDs of bonded users (active only) — used for catalog visibility
  const bondedUids = useMemo(() => activeBonds.map((b) => b.peerUid), [activeBonds]);

  // Get Kindle email for a specific user (from active bond)
  const getKindleEmailFor = useCallback(
    (targetUid) => {
      const bond = activeBonds.find((b) => b.peerUid === targetUid);
      return bond?.peerKindleEmail || null;
    },
    [activeBonds]
  );

  // Check if I have an active bond with someone
  const hasBondWith = useCallback(
    (targetUid) => activeBonds.some((b) => b.peerUid === targetUid),
    [activeBonds]
  );

  // Get bond status with a specific user
  const getBondStatus = useCallback(
    (targetUid) => {
      const bond = bonds.find((b) => b.peerUid === targetUid);
      if (!bond) return { status: 'none', bond: null };
      return { status: bond.status, bond };
    },
    [bonds]
  );

  // Initiate a bond with another user
  const createBond = useCallback(
    async (targetUid, targetName, myKindleEmail) => {
      if (!uid || !profile) return;
      const existing = bonds.find((b) => b.peerUid === targetUid);
      if (existing) return existing.id;

      const bondDoc = await addDoc(collection(db, 'bonds'), {
        userA: uid,
        userAName: profile.displayName,
        userB: targetUid,
        userBName: targetName,
        kindleEmailA: myKindleEmail,
        kindleEmailB: '',
        status: 'pending',
        initiatedBy: uid,
        createdAt: serverTimestamp(),
        activatedAt: null,
      });
      return bondDoc.id;
    },
    [uid, profile, bonds]
  );

  // Accept a pending bond (the other side) by providing my Kindle email
  const acceptBond = useCallback(
    async (bondId, myKindleEmail) => {
      const bond = bonds.find((b) => b.id === bondId);
      if (!bond) return;

      // Determine which field to update based on my role
      const isA = bond.raw.userA === uid;
      const updates = {
        status: 'active',
        activatedAt: serverTimestamp(),
      };
      if (isA) {
        updates.kindleEmailA = myKindleEmail;
      } else {
        updates.kindleEmailB = myKindleEmail;
      }
      await updateDoc(doc(db, 'bonds', bondId), updates);
    },
    [bonds, uid]
  );

  // Remove a bond
  const removeBond = useCallback(
    async (bondId) => {
      await deleteDoc(doc(db, 'bonds', bondId));
    },
    []
  );

  const value = {
    bonds,
    activeBonds,
    pendingBonds,
    bondedUids,
    getKindleEmailFor,
    hasBondWith,
    getBondStatus,
    createBond,
    acceptBond,
    removeBond,
  };

  return <BondsContext.Provider value={value}>{children}</BondsContext.Provider>;
}

export function useBonds() {
  const ctx = useContext(BondsContext);
  if (!ctx) throw new Error('useBonds must be used within BondsProvider');
  return ctx;
}
