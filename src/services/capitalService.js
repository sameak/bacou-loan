/**
 * CAPITAL SERVICE — track the lender's original capital in USD and KHR
 *
 * Stored in Firestore: users/{uid}  (fields: capitalUSD, capitalKHR)
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';

function getUid() {
  return auth.currentUser?.uid;
}

/**
 * Save/update capital amounts.
 */
export async function saveCapital({ capitalUSD = 0, capitalKHR = 0 }) {
  const uid = getUid();
  if (!uid) throw new Error('Not authenticated');
  await setDoc(doc(db, 'users', uid), { capitalUSD, capitalKHR }, { merge: true });
}

/**
 * Fetch capital once.
 */
export async function getCapital() {
  const uid = getUid();
  if (!uid) return { capitalUSD: 0, capitalKHR: 0 };
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { capitalUSD: 0, capitalKHR: 0 };
  const { capitalUSD = 0, capitalKHR = 0 } = snap.data();
  return { capitalUSD, capitalKHR };
}

/**
 * Real-time listener for capital.
 * Returns unsubscribe function.
 */
export function listenCapital(callback) {
  const uid = getUid();
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    snap => {
      const { capitalUSD = 0, capitalKHR = 0 } = snap.exists() ? snap.data() : {};
      callback({ capitalUSD, capitalKHR });
    },
    err => console.error('capital listener error:', err)
  );
}
