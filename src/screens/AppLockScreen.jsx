/**
 * APP LOCK SCREEN
 * Biometric prompt + PIN keypad. Matches the app's glass design language.
 */

import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { useAppLock } from '../context/AppLockContext';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../services/firebase';

const ACCENT  = '#00C2B2';
const PIN_LEN = 4;
const KEYS    = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

const T = {
  en: {
    locked:       'App Locked',
    authMsg:      'Authenticate to continue',
    unlock:       'Unlock',
    usePin:       'Use PIN instead',
    enterPin:     'Enter PIN',
    pinMsg:       'Enter your PIN to continue',
    wrongPin:     'Incorrect PIN',
    useFaceId:    'Use Face ID',
    useFingerprint:'Use Fingerprint',
    forgotPin:    'Forgot PIN?',
    forgotTitle:  'Forgot PIN',
    forgotMsg:    'Verify with biometrics to remove PIN, or sign out.',
    useBiometric: 'Use Biometrics',
    signOut:      'Sign Out',
    cancel:       'Cancel',
  },
  km: {
    locked:       'កម្មវិធីបានចាក់សោ',
    authMsg:      'ផ្ទៀងផ្ទាត់ដើម្បីបន្ត',
    unlock:       'ដោះសោ',
    usePin:       'ប្រើលេខសម្ងាត់',
    enterPin:     'បញ្ចូលលេខសម្ងាត់',
    pinMsg:       'វាយបញ្ចូលលេខសម្ងាត់',
    wrongPin:     'លេខសម្ងាត់មិនត្រឹមត្រូវ',
    useFaceId:    'ប្រើ Face ID',
    useFingerprint:'ប្រើស្នាមម្រាមដៃ',
    forgotPin:    'ភ្លេចលេខសម្ងាត់?',
    forgotTitle:  'ភ្លេចលេខសម្ងាត់',
    forgotMsg:    'ផ្ទៀងផ្ទាត់ជីវមាត្រដើម្បីដកលេខសម្ងាត់ ឬចាកចេញ',
    useBiometric: 'ប្រើជីវមាត្រ',
    signOut:      'ចាកចេញ',
    cancel:       'បោះបង់',
  },
};

export default function AppLockScreen() {
  const { biometricEnabled, biometricType, pinEnabled, unlockBiometric, unlockWithPIN, removePIN } = useAppLock();
  const { colors, isDark } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;

  const [pin,     setPin]     = useState('');
  const [error,   setError]   = useState(false);
  const [showPIN, setShowPIN] = useState(!biometricEnabled && pinEnabled);

  const isKhmer = true;
  const styles = useMemo(() => makeStyles(ff, language), [ff, language]);

  useEffect(() => {
    if (biometricEnabled) triggerBiometric();
  }, []);

  const triggerBiometric = useCallback(async () => {
    const result = await unlockBiometric();
    if (!result.success && pinEnabled) setShowPIN(true);
  }, [unlockBiometric, pinEnabled]);

  const handleForgotPIN = useCallback(() => {
    const buttons = [];
    if (biometricEnabled) {
      buttons.push({
        text: t.useBiometric,
        onPress: async () => {
          const result = await unlockBiometric();
          if (result.success) await removePIN();
        },
      });
    }
    buttons.push({
      text: t.signOut,
      style: 'destructive',
      onPress: () => signOut(auth),
    });
    buttons.push({ text: t.cancel, style: 'cancel' });
    Alert.alert(t.forgotTitle, t.forgotMsg, buttons);
  }, [biometricEnabled, unlockBiometric, removePIN, t]);

  const handleKey = useCallback(async (key) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (key === '')   return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LEN) {
      const ok = await unlockWithPIN(next);
      if (!ok) {
        setError(true);
        Vibration.vibrate(300);
        setTimeout(() => { setPin(''); setError(false); }, 650);
      }
    }
  }, [pin, unlockWithPIN]);

  const bg          = isDark ? '#080810' : '#F0F0F7';
  const keyBg       = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.72)';
  const keyBorder   = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
  const dotEmpty    = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.13)';

  // ── Biometric screen ─────────────────────────────────────────────────────────
  if (!showPIN) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.center}>
          <View style={[styles.lockCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)', borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)' }]}>
            <Ionicons name="lock-closed" size={46} color={ACCENT} />
          </View>

          <Text style={[styles.title, { color: colors.text, fontSize: fs(26) }]}>{t.locked}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs(15), lineHeight: isKhmer ? 26 : 20 }]}>{t.authMsg}</Text>

          <TouchableOpacity
            style={[styles.unlockBtn, { backgroundColor: ACCENT }]}
            onPress={triggerBiometric}
            activeOpacity={0.82}
          >
            <Ionicons name={biometricType === 'faceId' ? 'scan-outline' : 'finger-print'} size={20} color="#fff" />
            <Text style={[styles.unlockBtnText, { fontSize: fs(16) }]}>{t.unlock}</Text>
          </TouchableOpacity>

          {pinEnabled && (
            <TouchableOpacity onPress={() => setShowPIN(true)} style={styles.switchRow} activeOpacity={0.7}>
              <Text style={[styles.switchText, { color: colors.textMuted, fontSize: fs(14) }]}>{t.usePin}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => Alert.alert(t.forgotTitle, t.forgotMsg, [
              { text: t.signOut, style: 'destructive', onPress: () => signOut(auth) },
              { text: t.cancel, style: 'cancel' },
            ])}
            style={[styles.switchRow, { marginTop: 8 }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchText, { color: '#EF4444', fontSize: fs(13) }]}>{t.signOut}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PIN keypad ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.center}>
        <View style={[styles.lockCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)', borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)' }]}>
          <Ionicons name="keypad-outline" size={42} color={ACCENT} />
        </View>

        <Text style={[styles.title, { color: colors.text, fontSize: fs(26) }]}>{t.enterPin}</Text>
        <Text style={[styles.subtitle, { color: error ? '#EF4444' : colors.textMuted, fontSize: fs(14), lineHeight: isKhmer ? 23 : 18 }]}>
          {error ? t.wrongPin : t.pinMsg}
        </Text>

        {/* Dots */}
        <View style={styles.dots}>
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < pin.length
                    ? (error ? '#EF4444' : ACCENT)
                    : dotEmpty,
                  transform: [{ scale: i < pin.length ? 1.15 : 1 }],
                },
              ]}
            />
          ))}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {KEYS.map((key, i) => (
            key === '' ? (
              <View key={i} style={styles.keySlot} />
            ) : (
              <TouchableOpacity
                key={i}
                style={[styles.keySlot]}
                onPress={() => handleKey(key)}
                activeOpacity={0.65}
              >
                <View style={[styles.keyBtn, { backgroundColor: keyBg, borderColor: keyBorder }]}>
                  {key === '⌫'
                    ? <Ionicons name="backspace-outline" size={22} color={colors.text} />
                    : <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                  }
                </View>
              </TouchableOpacity>
            )
          ))}
        </View>

        {biometricEnabled && (
          <TouchableOpacity onPress={triggerBiometric} style={styles.switchRow} activeOpacity={0.7}>
            <Ionicons name={biometricType === 'faceId' ? 'scan-outline' : 'finger-print'} size={15} color={colors.textMuted} />
            <Text style={[styles.switchText, { color: colors.textMuted, fontSize: fs(14), marginLeft: 5 }]}>
              {biometricType === 'faceId' ? t.useFaceId : t.useFingerprint}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleForgotPIN} style={[styles.switchRow, { marginTop: 8 }]} activeOpacity={0.7}>
          <Text style={[styles.switchText, { color: '#EF4444', fontSize: fs(13) }]}>{t.forgotPin}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (ff, language) => {
  const km = true;
  return StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { alignItems: 'center', width: '100%', paddingHorizontal: 28 },

  lockCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title:    { ...ff('700'), letterSpacing: 0, marginBottom: 6, textAlign: 'center' },
  subtitle: { marginBottom: 32, textAlign: 'center' },

  // Biometric
  unlockBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 34, paddingVertical: 15, borderRadius: 16 },
  unlockBtnText: { color: '#fff', ...ff('700') },
  switchRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingVertical: 6 },
  switchText:    { ...ff('500') },

  // PIN pad
  dots:   { flexDirection: 'row', gap: 18, marginBottom: 40 },
  dot:    { width: 13, height: 13, borderRadius: 6.5 },

  keypad:  { flexDirection: 'row', flexWrap: 'wrap', width: 288, justifyContent: 'center' },
  keySlot: { width: 96, height: 80, justifyContent: 'center', alignItems: 'center' },
  keyBtn:  {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { fontSize: 26, ...ff('400') },
});
};
