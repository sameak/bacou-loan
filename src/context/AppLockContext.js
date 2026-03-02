/**
 * APP LOCK CONTEXT
 * Locks the app with biometric after 30 seconds in background.
 * Auto-triggers biometric prompt when app returns to foreground.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const AppLockContext = createContext(null);

const LOCK_AFTER_MS = 30 * 1000; // lock after 30s in background

export function AppLockProvider({ children }) {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const backgroundedAt = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Check if device has biometric enrolled
  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return;
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(isEnrolled);
    })();
  }, []);

  // Lock when app returns from background after LOCK_AFTER_MS
  useEffect(() => {
    if (!biometricAvailable) return;
    const sub = AppState.addEventListener('change', next => {
      const current = appStateRef.current;
      if (current === 'active' && next.match(/inactive|background/)) {
        backgroundedAt.current = Date.now();
      } else if (current.match(/inactive|background/) && next === 'active') {
        if (backgroundedAt.current && Date.now() - backgroundedAt.current > LOCK_AFTER_MS) {
          setIsLocked(true);
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [biometricAvailable]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to open Bacou',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });
    if (result.success) setIsLocked(false);
  }, []);

  return (
    <AppLockContext.Provider value={{ isLocked, unlock, biometricAvailable }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
