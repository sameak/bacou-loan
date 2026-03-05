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
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from './firebase';

const SESSION_KEY       = 'bacou_session_id';
const LOGIN_TIME_KEY    = 'bacou_session_login_time';

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

    // Track whether this is the first time we're recording this session
    const isNew = !(await AsyncStorage.getItem(LOGIN_TIME_KEY));
    if (isNew) await AsyncStorage.setItem(LOGIN_TIME_KEY, new Date().toISOString());

    const user = auth.currentUser;
    const displayName = user?.displayName || user?.phoneNumber || 'Unknown';

    const data = {
      uid,
      displayName,
      sessionId,
      platform: Platform.OS,
      deviceModel: getDeviceModel(),
      osVersion: String(Platform.Version),
      lastSeen: serverTimestamp(),
      ...(isNew && { loginTime: serverTimestamp() }),
    };

    // setDoc with merge — creates on first call, updates lastSeen on subsequent calls.
    // No getDoc needed, so no permission issue with null resource.
    await setDoc(doc(db, 'sessions', sessionId), data, { merge: true });
  } catch (e) {
    console.warn('recordSession error:', e);
  }
}

/** Real-time listener for all sessions belonging to the current user. */
export function listenSessions(callback, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) { onError?.(); return () => {}; }
  const q = query(
    collection(db, 'sessions'),
    where('uid', '==', uid),
  );
  return onSnapshot(
    q,
    snap => {
      const sessions = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0));
      callback(sessions);
    },
    err => { console.error('sessions listener error:', err); onError?.(); },
  );
}

/** Remove a session document (logs out that device from history). */
export async function removeSession(sessionId) {
  await deleteDoc(doc(db, 'sessions', sessionId));
}

/** Sync the current device's security method state to its session doc. */
export async function updateSessionSecurity({ pinEnabled, biometricEnabled, biometricType }) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const sessionId = await getOrCreateSessionId();
    await setDoc(doc(db, 'sessions', sessionId), {
      uid,
      pinEnabled:       !!pinEnabled,
      biometricEnabled: !!biometricEnabled,
      biometricType:    biometricType || 'fingerprint',
    }, { merge: true });
  } catch (e) {
    console.warn('updateSessionSecurity error:', e);
  }
}

/** Real-time online status for a specific user (based on their most-recent lastSeen). */
export function listenUserOnlineStatus(targetUid, callback) {
  const q = query(collection(db, 'sessions'), where('uid', '==', targetUid));
  return onSnapshot(
    q,
    snap => {
      const maxSeen = snap.docs.reduce((max, d) => {
        const t = d.data().lastSeen?.seconds ?? 0;
        return t > max ? t : max;
      }, 0);
      if (!maxSeen) { callback('offline'); return; }
      const diff = Date.now() / 1000 - maxSeen;
      if (diff < 5 * 60)  callback('online');
      else if (diff < 60 * 60) callback('away');
      else callback('offline');
    },
    () => callback('offline'),
  );
}

/** Admin: real-time listener for ALL sessions across all users. */
export function listenAllSessions(callback, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) { onError?.(); return () => {}; }
  return onSnapshot(
    collection(db, 'sessions'),
    snap => {
      const sessions = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0));
      callback(sessions);
    },
    err => { console.error('all-sessions listener error:', err); onError?.(); },
  );
}
