/**
 * BORROWER SERVICE — CRUD for /borrowers/{id}
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  getDocs,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const COLL = 'borrowers';

function getUid() {
  return auth.currentUser?.uid;
}

function getUserInfo() {
  const user = auth.currentUser;
  return {
    uid: user?.uid ?? '',
    name: user?.displayName || user?.email || 'Unknown',
  };
}

/**
 * Create a new borrower.
 * Returns the new borrower document with id.
 */
export async function createBorrower({ name, phone, address = '', notes = '' }) {
  const uid = getUid();
  if (!uid) throw new Error('Not authenticated');

  const { name: userName } = getUserInfo();

  const ref = await addDoc(collection(db, COLL), {
    ownerId: uid,
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    notes: notes.trim(),
    createdBy: uid,
    createdByName: userName,
    createdAt: serverTimestamp(),
  });

  return { id: ref.id, ownerId: uid, name, phone, address, notes };
}

/**
 * Update borrower fields.
 */
export async function updateBorrower(borrowerId, fields) {
  const { uid, name: userName } = getUserInfo();
  const ref = doc(db, COLL, borrowerId);
  await updateDoc(ref, {
    ...fields,
    updatedBy: uid,
    updatedByName: userName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a borrower (does NOT delete their loans — handle separately).
 */
export async function deleteBorrower(borrowerId) {
  await deleteDoc(doc(db, COLL, borrowerId));
}

/**
 * Fetch all borrowers for the current user, ordered by name.
 */
export async function getBorrowers() {
  const uid = getUid();
  if (!uid) return [];

  const q = query(collection(db, COLL), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Listen to borrowers in real-time.
 * Returns an unsubscribe function.
 */
export function listenBorrowers(callback) {
  const uid = getUid();
  if (!uid) return () => {};

  const q = query(collection(db, COLL));

  return onSnapshot(q, snap => {
    const borrowers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort client-side to avoid composite index requirement
    borrowers.sort((a, b) => a.name.localeCompare(b.name));
    callback(borrowers);
  }, err => console.error('borrower listener error:', err));
}
