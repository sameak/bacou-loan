/**
 * FIREBASE CONFIG — Bacou Loan
 *
 * ⚠️  Replace the placeholder values below with your actual Firebase project config.
 * Get them from: Firebase Console → Project Settings → Your apps → SDK setup
 *
 * Required Firebase services to enable:
 *   1. Authentication → Phone (enable Phone sign-in)
 *   2. Firestore Database (start in test mode then secure with rules)
 *
 * Firestore security rules (deploy via Firebase Console or CLI):
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /borrowers/{id} {
 *         allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerId;
 *         allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerId;
 *       }
 *       match /loans/{id} {
 *         allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerId;
 *         allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerId;
 *         match /schedule/{pid} { allow read, write: if request.auth != null; }
 *         match /payments/{pid} { allow read, write: if request.auth != null; }
 *       }
 *     }
 *   }
 */

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyAzayXPLxTR6Pekbyfwpt7InJ1QnR9G_1U',
  authDomain: 'bacon-loan.firebaseapp.com',
  projectId: 'bacon-loan',
  storageBucket: 'bacon-loan.firebasestorage.app',
  messagingSenderId: '1055435398551',
  appId: '1:1055435398551:web:c01dc7733a2bdc80b5f8d2',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// experimentalAutoDetectLongPolling: Firebase detects the best transport
// for React Native — avoids the slow gRPC-Web default that causes 1–3s
// connection delays on mobile networks.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export default app;
