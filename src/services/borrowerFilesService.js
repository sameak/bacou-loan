/**
 * BORROWER FILES SERVICE — Firebase Storage + Firestore metadata
 *
 * Storage path : borrowers/{borrowerId}/{timestamp}_{filename}
 * Firestore    : borrowers/{borrowerId}/files/{fileId}
 */

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';

function getUserInfo() {
  const user = auth.currentUser;
  return {
    uid: user?.uid ?? '',
    name: user?.displayName || user?.phoneNumber || 'Unknown',
  };
}

/**
 * Upload a file to Firebase Storage and save its metadata to Firestore.
 * Returns the saved file metadata.
 */
export async function uploadBorrowerFile(borrowerId, fileUri, fileName, mimeType) {
  const { uid, name: userName } = getUserInfo();
  if (!uid) throw new Error('Not authenticated');

  const response = await fetch(fileUri);
  const blob = await response.blob();
  const fileSize = blob.size;

  const timestamp = Date.now();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `borrowers/${borrowerId}/${timestamp}_${safeFileName}`;

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: mimeType });
  const url = await getDownloadURL(storageRef);

  const fileRef = await addDoc(collection(db, 'borrowers', borrowerId, 'files'), {
    name: fileName,
    url,
    mimeType: mimeType || 'application/octet-stream',
    storagePath,
    size: fileSize,
    createdBy: uid,
    createdByName: userName,
    createdAt: serverTimestamp(),
  });

  return { id: fileRef.id, name: fileName, url, mimeType, storagePath, size: fileSize };
}

/**
 * Real-time listener for all files attached to a borrower.
 * Returns an unsubscribe function.
 */
export function listenBorrowerFiles(borrowerId, callback) {
  return onSnapshot(
    collection(db, 'borrowers', borrowerId, 'files'),
    snap => {
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      files.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      callback(files);
    },
    err => console.error('borrower files listener error:', err)
  );
}

/**
 * Delete a file from Firebase Storage and remove its Firestore record.
 */
export async function deleteBorrowerFile(borrowerId, fileId, storagePath) {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (e) {
    // File might already be gone — continue
    console.warn('Storage delete warning:', e.message);
  }
  await deleteDoc(doc(db, 'borrowers', borrowerId, 'files', fileId));
}
