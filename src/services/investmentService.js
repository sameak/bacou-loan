/**
 * INVESTMENT SERVICE — external investments tracker
 *
 * Stored in Firestore: investments/{id}  (shared across all owners)
 * Each investment tracks: name, currency, principal, monthly return, duration, start date.
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, db } from './firebase';

function getUserInfo() {
  const user = auth.currentUser;
  return {
    uid: user?.uid ?? '',
    name: user?.displayName || user?.email || 'Unknown',
  };
}

const COLL = () => collection(db, 'investments');

/**
 * Add a new investment.
 */
export async function addInvestment(data) {
  const { uid, name } = getUserInfo();
  await addDoc(COLL(), {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: uid,
    createdByName: name,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    updatedByName: name,
  });
}

/**
 * Update an existing investment.
 */
export async function updateInvestment(id, data) {
  const { uid, name } = getUserInfo();
  await updateDoc(doc(db, 'investments', id), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    updatedByName: name,
  });
}

/**
 * Delete an investment.
 */
export async function deleteInvestment(id) {
  await deleteDoc(doc(db, 'investments', id));
}

/**
 * Real-time listener for all investments (ordered by creation time).
 * Returns unsubscribe function.
 */
export function listenInvestments(callback) {
  const q = query(COLL(), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('investments listener error:', err),
  );
}
