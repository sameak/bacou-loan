/**
 * CAPITAL SERVICE — shared business capital in USD and KHR
 *
 * Stored in Firestore: settings/capital  (single shared document)
 * All authenticated owners read and write the same document.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

const CAPITAL_REF = () => doc(db, 'settings', 'capital');

/**
 * Save/update capital amounts.
 */
export async function saveCapital({ capitalUSD = 0, capitalKHR = 0 }) {
  await setDoc(CAPITAL_REF(), { capitalUSD, capitalKHR }, { merge: true });
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
 * Real-time listener for capital.
 * Returns unsubscribe function.
 */
export function listenCapital(callback) {
  return onSnapshot(
    CAPITAL_REF(),
    snap => {
      const { capitalUSD = 0, capitalKHR = 0 } = snap.exists() ? snap.data() : {};
      callback({ capitalUSD, capitalKHR });
    },
    err => console.error('capital listener error:', err)
  );
}
