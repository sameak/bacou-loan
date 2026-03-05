/**
 * CHAT SERVICE — Real-time team chat via Firestore + Firebase Storage
 *
 * Collections:
 *   /chats/{chatId}                  — chat metadata, members, unread counts
 *   /chats/{chatId}/messages/{msgId} — individual messages
 *
 * Chat ID conventions:
 *   Group : group_main
 *   DM    : dm_{sorted uid1}_{sorted uid2}
 */

import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';

function getUserInfo() {
  const user = auth.currentUser;
  return {
    uid: user?.uid ?? '',
    name: user?.displayName || user?.phoneNumber || 'Unknown',
  };
}

export function dmChatId(uidA, uidB) {
  return `dm_${[uidA, uidB].sort().join('_')}`;
}

/** Ensure the global group chat document exists. */
export async function ensureGroupChat() {
  const { uid, name } = getUserInfo();
  if (!uid) return;
  const chatRef = doc(db, 'chats', 'group_main');
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      type: 'group',
      members: [uid],
      memberNames: { [uid]: name },
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      lastMessageBy: uid,
      unreadCounts: {},
    });
  } else {
    // Add self to members list if not already there
    const data = snap.data();
    if (!data.members?.includes(uid)) {
      await updateDoc(chatRef, {
        members: arrayUnion(uid),
        [`memberNames.${uid}`]: name,
      });
    }
  }
}

/** Get or create a DM chat between current user and otherUid. */
export async function ensureDmChat(otherUid, otherName) {
  const { uid, name } = getUserInfo();
  if (!uid) return null;
  const chatId = dmChatId(uid, otherUid);
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      type: 'dm',
      members: [uid, otherUid],
      memberNames: { [uid]: name, [otherUid]: otherName },
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      lastMessageBy: uid,
      unreadCounts: { [uid]: 0, [otherUid]: 0 },
    });
  }
  return chatId;
}

/** Send a text message to a chat. */
/** Send a text message, with optional reply-to quote. */
export async function sendMessage(chatId, text, replyTo = null) {
  const { uid, name } = getUserInfo();
  if (!uid || !text.trim()) return;

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  const members = chatSnap.data()?.members ?? [];
  const otherMembers = members.filter(m => m !== uid);

  // Build unread increment patch for other members
  const unreadPatch = {};
  otherMembers.forEach(m => { unreadPatch[`unreadCounts.${m}`] = increment(1); });

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    type: 'text',
    text: text.trim(),
    senderId: uid,
    senderName: name,
    createdAt: serverTimestamp(),
    ...(replyTo && { replyTo }),
  });

  await updateDoc(chatRef, {
    lastMessage: text.trim(),
    lastMessageTime: serverTimestamp(),
    lastMessageBy: uid,
    ...unreadPatch,
  });
}

/** Convert a local file:// URI to a Blob using XMLHttpRequest (works on iOS & Android). */
function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload  = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('uriToBlob failed'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/** Upload a file to Storage then send a file message. */
export async function sendFileMessage(chatId, fileUri, fileName, fileSize, mimeType) {
  const { uid, name } = getUserInfo();
  if (!uid) return;

  const blob = await uriToBlob(fileUri);
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `chat/${chatId}/${timestamp}_${safeName}`);
  await uploadBytes(storageRef, blob, { contentType: mimeType ?? 'application/octet-stream' });
  const fileUrl = await getDownloadURL(storageRef);

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  const members = chatSnap.data()?.members ?? [];
  const otherMembers = members.filter(m => m !== uid);
  const unreadPatch = {};
  otherMembers.forEach(m => { unreadPatch[`unreadCounts.${m}`] = increment(1); });

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    type: 'file',
    fileUrl,
    fileName,
    fileSize: fileSize ?? 0,
    mimeType: mimeType ?? '',
    senderId: uid,
    senderName: name,
    createdAt: serverTimestamp(),
  });

  await updateDoc(chatRef, {
    lastMessage: `📎 ${fileName}`,
    lastMessageTime: serverTimestamp(),
    lastMessageBy: uid,
    ...unreadPatch,
  });
}

/** Upload image to Storage then send an image message. */
export async function sendImageMessage(chatId, imageUri) {
  const { uid, name } = getUserInfo();
  if (!uid) return;

  const blob = await uriToBlob(imageUri);
  const timestamp = Date.now();
  const storagePath = `chat/${chatId}/${timestamp}.jpg`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const imageUrl = await getDownloadURL(storageRef);

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  const members = chatSnap.data()?.members ?? [];
  const otherMembers = members.filter(m => m !== uid);

  const unreadPatch = {};
  otherMembers.forEach(m => { unreadPatch[`unreadCounts.${m}`] = increment(1); });

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    type: 'image',
    imageUrl,
    senderId: uid,
    senderName: name,
    createdAt: serverTimestamp(),
  });

  await updateDoc(chatRef, {
    lastMessage: '📷 Photo',
    lastMessageTime: serverTimestamp(),
    lastMessageBy: uid,
    ...unreadPatch,
  });
}

/** Reset unread count for current user in a chat. */
export async function markRead(chatId) {
  const { uid } = getUserInfo();
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      [`unreadCounts.${uid}`]: 0,
    });
  } catch (_) {}
}

/** Real-time listener for all chats the current user belongs to. */
export function listenChats(callback) {
  const { uid } = getUserInfo();
  if (!uid) return () => {};
  const q = query(
    collection(db, 'chats'),
    where('members', 'array-contains', uid),
    orderBy('lastMessageTime', 'desc'),
  );
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('listenChats error:', err),
  );
}

/** Real-time listener for messages in a chat (newest first, limit 50). */
export function listenMessages(chatId, callback) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('listenMessages error:', err),
  );
}

/**
 * Set or clear the current user's typing status in a chat.
 * `typingUsers.{uid}` = serverTimestamp() when typing, deleted when not.
 */
export async function setTyping(chatId, isTyping) {
  const { uid } = getUserInfo();
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      [`typingUsers.${uid}`]: isTyping ? serverTimestamp() : deleteField(),
    });
  } catch (_) {}
}

/** Real-time listener for chat metadata (members, typingUsers, etc). */
export function listenChatMeta(chatId, callback) {
  return onSnapshot(
    doc(db, 'chats', chatId),
    snap => callback(snap.data() ?? {}),
    err => console.error('listenChatMeta error:', err),
  );
}
