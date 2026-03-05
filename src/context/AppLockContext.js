/**
 * APP LOCK CONTEXT
 * Supports biometric (Face ID / fingerprint) and PIN lock.
 * Locks after 30 seconds in background — only when at least one method is enabled.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { updateSessionSecurity } from '../services/sessionService';

const AppLockContext = createContext(null);

const LOCK_AFTER_MS   = 30 * 1000;
const KEY_BIOMETRIC   = 'lock_biometric_enabled';
const PIN_SECURE_KEY  = 'bacou_lock_pin';

export function AppLockProvider({ children }) {
  const [isLocked,         setIsLocked]          = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled,  setBiometricEnabled]  = useState(false);
  const [biometricType,     setBiometricType]     = useState('fingerprint'); // 'faceId' | 'fingerprint'
  const [pinEnabled,        setPinEnabled]         = useState(false);
  const [prefsLoaded,       setPrefsLoaded]        = useState(false);

  const backgroundedAt = useRef(null);
  const appStateRef    = useRef(AppState.currentState);

  // Load saved prefs + check hardware
  useEffect(() => {
    (async () => {
      const hasHw     = await LocalAuthentication.hasHardwareAsync();
      const enrolled  = hasHw ? await LocalAuthentication.isEnrolledAsync() : false;
      setBiometricAvailable(enrolled);

      // Hoist hasFaceId so it's accessible after the if block
      let hasFaceId = false;
      if (enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        // AuthenticationType.FACIAL_RECOGNITION = 2
        hasFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        setBiometricType(hasFaceId ? 'faceId' : 'fingerprint');
      }

      const [bioPref, existingPin] = await Promise.all([
        AsyncStorage.getItem(KEY_BIOMETRIC),
        SecureStore.getItemAsync(PIN_SECURE_KEY),
      ]);

      const bioEnabled = bioPref === 'true' && enrolled;
      const resolvedType = hasFaceId ? 'faceId' : 'fingerprint';
      setBiometricEnabled(bioEnabled);
      setPinEnabled(!!existingPin);
      setPrefsLoaded(true);

      // Sync current security state to Firestore so admin can see it
      updateSessionSecurity({
        pinEnabled:       !!existingPin,
        biometricEnabled: bioEnabled,
        biometricType:    resolvedType,
      });
    })();
  }, []);

  // Lock when returning from background (only if a lock method is enabled)
  useEffect(() => {
    const lockEnabled = biometricEnabled || pinEnabled;
    if (!prefsLoaded || !lockEnabled) return;

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
  }, [prefsLoaded, biometricEnabled, pinEnabled]);

  // ── Biometric toggle ──────────────────────────────────────────────────────────
  /** When enabling, requires a successful biometric prompt first (to verify it works).
   *  Disabling is allowed freely — the user is already in the app.
   *  Returns true if the change was applied, false if cancelled. */
  const toggleBiometric = useCallback(async (enabled) => {
    if (enabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify to enable biometric unlock',
        disableDeviceFallback: false, // allow device passcode if biometric fails
      });
      if (!result.success) return false;
    }
    const bioEnabled = enabled && biometricAvailable;
    await AsyncStorage.setItem(KEY_BIOMETRIC, String(enabled));
    setBiometricEnabled(bioEnabled);
    updateSessionSecurity({ pinEnabled, biometricEnabled: bioEnabled, biometricType });
    return true;
  }, [biometricAvailable, pinEnabled, biometricType]);

  // ── PIN management ────────────────────────────────────────────────────────────
  const savePIN = useCallback(async (pin) => {
    await SecureStore.setItemAsync(PIN_SECURE_KEY, pin);
    setPinEnabled(true);
    updateSessionSecurity({ pinEnabled: true, biometricEnabled, biometricType });
  }, [biometricEnabled, biometricType]);

  const removePIN = useCallback(async () => {
    await SecureStore.deleteItemAsync(PIN_SECURE_KEY);
    setPinEnabled(false);
    updateSessionSecurity({ pinEnabled: false, biometricEnabled, biometricType });
  }, [biometricEnabled, biometricType]);

  const verifyPIN = useCallback(async (pin) => {
    const stored = await SecureStore.getItemAsync(PIN_SECURE_KEY);
    return stored === pin;
  }, []);

  // ── Unlock ────────────────────────────────────────────────────────────────────
  /** Triggers biometric prompt. Returns { success, cancelled } */
  const unlockBiometric = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to open Bacou',
      disableDeviceFallback: false,
    });
    if (result.success) setIsLocked(false);
    return result;
  }, []);

  /** Checks PIN. Returns true on match and unlocks. */
  const unlockWithPIN = useCallback(async (pin) => {
    const ok = await verifyPIN(pin);
    if (ok) setIsLocked(false);
    return ok;
  }, [verifyPIN]);

  return (
    <AppLockContext.Provider value={{
      isLocked,
      biometricAvailable,
      biometricEnabled,
      biometricType,
      pinEnabled,
      prefsLoaded,
      toggleBiometric,
      savePIN,
      removePIN,
      verifyPIN,
      unlockBiometric,
      unlockWithPIN,
    }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
