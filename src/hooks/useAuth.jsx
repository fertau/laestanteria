import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

/**
 * Auth states:
 * - user === undefined → loading
 * - user === null → no session → Login
 * - user.profile === null → authenticated but no profile → InviteCodeEntry
 * - user.profile exists → fully authenticated
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: undefined, // undefined = loading
    profile: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, profile: null });
        return;
      }

      // Check if user has a profile in /users/{uid}
      try {
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (profileDoc.exists()) {
          setState({
            user: firebaseUser,
            profile: { id: profileDoc.id, ...profileDoc.data() },
          });
        } else {
          // Authenticated but no profile — needs invite code
          setState({
            user: firebaseUser,
            profile: null,
          });
        }
      } catch (err) {
        console.error('Error checking profile:', err);
        setState({
          user: firebaseUser,
          profile: null,
        });
      }
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result;
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return null;
      if (err.code === 'auth/popup-blocked') {
        console.warn('Popup blocked — user may need to allow popups');
        return null;
      }
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setState({ user: null, profile: null });
  }, []);

  const validateInviteCode = useCallback(
    async (code) => {
      const firebaseUser = state.user;
      if (!firebaseUser) throw new Error('No hay sesion activa');

      const codeUpper = code.toUpperCase().trim();
      const codeRef = doc(db, 'inviteCodes', codeUpper);

      await runTransaction(db, async (transaction) => {
        const codeDoc = await transaction.get(codeRef);
        if (!codeDoc.exists()) throw new Error('Codigo no valido');
        if (codeDoc.data().usedBy) throw new Error('Codigo ya utilizado');

        // Mark code as used
        transaction.update(codeRef, {
          usedBy: firebaseUser.uid,
          usedAt: serverTimestamp(),
        });

        // Create user profile
        const profileData = {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          avatar: firebaseUser.photoURL || null,
          kindleEmail: null,
          senderEmail: null,
          smtpConfigured: false,
          notifyDigest: true,
          fcmToken: null,
          privacyMode: 'open',
          joinedAt: serverTimestamp(),
        };
        transaction.set(doc(db, 'users', firebaseUser.uid), profileData);
      });

      // Reload profile
      const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      setState((prev) => ({
        ...prev,
        profile: { id: profileDoc.id, ...profileDoc.data() },
      }));
    },
    [state.user]
  );

  const generateInviteCode = useCallback(async () => {
    if (!state.user || !state.profile) throw new Error('No autenticado');

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    await setDoc(doc(db, 'inviteCodes', code), {
      generatedBy: state.user.uid,
      usedBy: null,
      usedAt: null,
      createdAt: serverTimestamp(),
    });

    return code;
  }, [state.user, state.profile]);

  const getMyInviteCodes = useCallback(async () => {
    if (!state.user) return [];
    const q = query(
      collection(db, 'inviteCodes'),
      where('generatedBy', '==', state.user.uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ code: d.id, ...d.data() }));
  }, [state.user]);

  const updateProfile = useCallback(
    async (updates) => {
      if (!state.user) return;
      await updateDoc(doc(db, 'users', state.user.uid), updates);
      setState((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...updates },
      }));
    },
    [state.user]
  );

  const value = {
    user: state.user,
    profile: state.profile,
    signIn,
    signOut,
    validateInviteCode,
    generateInviteCode,
    getMyInviteCodes,
    updateProfile,
    isLoading: state.user === undefined,
    isAuthenticated: state.user !== null && state.user !== undefined,
    hasProfile: state.profile !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
