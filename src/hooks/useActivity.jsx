import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useFollows } from './useFollows';

export function useActivity(maxItems = 20) {
  const { user, profile } = useAuth();
  const { activityFollowingUids } = useFollows();
  const uid = user?.uid;

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !profile) {
      setActivities([]);
      setLoading(false);
      return;
    }

    // Build list of UIDs whose activity to show (me + all I follow)
    const visibleUids = [uid, ...activityFollowingUids];

    // Firestore 'in' supports up to 30 values
    if (visibleUids.length === 0) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'activity'),
      where('actorUid', 'in', visibleUids),
      orderBy('createdAt', 'desc'),
      limit(maxItems),
    );

    return onSnapshot(q, (snap) => {
      setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [uid, profile, activityFollowingUids, maxItems]);

  return { activities, loading };
}
