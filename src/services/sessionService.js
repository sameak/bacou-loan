/**
 * SESSION SERVICE
 * Tracks login history and active devices in Firestore.
 *
 * Firestore rules to add for /sessions collection:
 *   match /sessions/{sessionId} {
 *     allow read, delete: if request.auth != null && request.auth.uid == resource.data.uid;
 *     allow create, update: if request.auth != null && request.auth.uid == request.resource.data.uid;
 *   }
 *
 * Composite index needed:
 *   Collection: sessions  |  uid ASC, lastSeen DESC
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from './firebase';

const SESSION_KEY = 'bacou_session_id';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function getDeviceModel() {
  if (Platform.OS === 'ios') return 'iPhone';
  return Platform.constants?.Model || 'Android Device';
}

export async function getOrCreateSessionId() {
  let id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateId();
    await AsyncStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Call once when the user is confirmed logged in. */
export async function recordSession() {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const sessionId = await getOrCreateSessionId();
    const ref = doc(db, 'sessions', sessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        sessionId,
        platform: Platform.OS,
        deviceModel: getDeviceModel(),
        osVersion: String(Platform.Version),
        loginTime: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { lastSeen: serverTimestamp() });
    }
  } catch (e) {
    console.warn('recordSession error:', e);
  }
}

/** Real-time listener for all sessions belonging to the current user. */
export function listenSessions(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const q = query(
    collection(db, 'sessions'),
    where('uid', '==', uid),
    orderBy('lastSeen', 'desc'),
  );
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('sessions listener error:', err),
  );
}

/** Remove a session document (logs out that device from history). */
export async function removeSession(sessionId) {
  await deleteDoc(doc(db, 'sessions', sessionId));
}
