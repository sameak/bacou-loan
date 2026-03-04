/**
 * CAPITAL SERVICE — shared business capital in USD and KHR
 *
 * Current value:  settings/capital          (single shared document)
 * Change history: capitalHistory/{autoId}   (append-only log)
 *
 * All authenticated owners read and write the same documents.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const CAPITAL_REF = () => doc(db, 'settings', 'capital');
const HISTORY_COLL = () => collection(db, 'capitalHistory');

function getUserInfo() {
  const user = auth.currentUser;
  return {
    uid:  user?.uid  ?? '',
    name: user?.displayName || user?.email || 'Unknown',
  };
}

/**
 * Save/update capital amounts and append a history entry.
 */
export async function saveCapital({ capitalUSD = 0, capitalKHR = 0 }) {
  const { uid, name } = getUserInfo();
  await setDoc(CAPITAL_REF(), { capitalUSD, capitalKHR }, { merge: true });
  await addDoc(HISTORY_COLL(), {
    capitalUSD,
    capitalKHR,
    updatedAt:       serverTimestamp(),
    updatedBy:       uid,
    updatedByName:   name,
  });
}

/**
 * Fetch capital once.
 */
export async function getCapital() {
  const snap = await getDoc(CAPITAL_REF());
  if (!snap.exists()) return { capitalUSD: 0, capitalKHR: 0 };
  const { capitalUSD = 0, capitalKHR = 0 } = snap.data();
  return { capitalUSD, capitalKHR };
}

/**
 * Real-time listener for current capital.
 * Returns unsubscribe function.
 */
export function listenCapital(callback) {
  return onSnapshot(
    CAPITAL_REF(),
    snap => {
      const { capitalUSD = 0, capitalKHR = 0 } = snap.exists() ? snap.data() : {};
      callback({ capitalUSD, capitalKHR });
    },
    err => console.error('capital listener error:', err),
  );
}

/**
 * Real-time listener for capital change history (newest first).
 * Returns unsubscribe function.
 */
export function listenCapitalHistory(callback) {
  const q = query(HISTORY_COLL(), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('capital history listener error:', err),
  );
}
