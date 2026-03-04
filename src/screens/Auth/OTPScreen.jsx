/**
 * OTP SCREEN — Verify phone with 6-digit code
 */

import { Ionicons } from '@expo/vector-icons';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebase';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const T = {
  en: {
    title: 'Verify Number',
    sub: (phone) => `Enter the 6-digit code sent to ${phone}`,
    verify: 'Verify',
    resend: 'Resend Code',
    resendIn: (s) => `Resend in ${s}s`,
    errInvalid: 'Invalid code. Please try again.',
    errExpired: 'Code expired. Please request a new one.',
    errGeneral: 'Verification failed. Try again.',
  },
  km: {
    title: 'ផ្ទៀងផ្ទាត់លេខ',
    sub: (phone) => `បញ្ចូលលេខកូដ 6 ខ្ទង់ដែលបានផ្ញើទៅ ${phone}`,
    verify: 'ផ្ទៀងផ្ទាត់',
    resend: 'ផ្ញើកូដម្ដងទៀត',
    resendIn: (s) => `ផ្ញើម្ដងទៀតក្នុង ${s}s`,
    errInvalid: 'លេខកូដមិនត្រឹមត្រូវ។ សូមព្យាយាមម្ដងទៀត។',
    errExpired: 'លេខកូដផុតកំណត់។ សូមស្នើសុំថ្មី។',
    errGeneral: 'ការផ្ទៀងផ្ទាត់បរាជ័យ។ ព្យាយាមម្ដងទៀត។',
  },
};

const RESEND_SECONDS = 60;
const DARK_INDIGO = '#312e81';

const OTPScreen = ({ navigation, route }) => {
  const { verificationId, phone } = route.params;
  const { colors, isDark } = useTheme();
  const { language, ff } = useLanguage();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (code.length !== 6 || loading) return;
    setError('');
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await signInWithCredential(auth, credential);
      // AppNavigator handles redirect on auth state change
    } catch (err) {
      const c = err.code;
      if (c === 'auth/invalid-verification-code') setError(t.errInvalid);
      else if (c === 'auth/code-expired') setError(t.errExpired);
      else setError(t.errGeneral);
    } finally {
      setLoading(false);
    }
  };

  const inputBg = isDark ? colors.surface : '#F2F4F8';

  return (
    <View style={[styles.root, { backgroundColor: DARK_INDIGO }]}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark" size={36} color="#fff" />
            </View>
            <Text style={styles.heading}>{t.title}</Text>
            <Text style={styles.sub}>{t.sub(phone)}</Text>
          </View>

          <SafeAreaView edges={['bottom']} style={[styles.card, { backgroundColor: colors.background }]}>
            <View style={styles.cardInner}>
              {!!error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={[styles.label, { color: colors.textMuted }]}>VERIFICATION CODE</Text>

              <TextInput
                ref={inputRef}
                style={[styles.otpInput, { backgroundColor: inputBg, color: colors.text }]}
                value={code}
                onChangeText={(v) => { setError(''); setCode(v.replace(/\D/g, '').slice(0, 6)); }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="• • • • • •"
                placeholderTextColor={colors.textMuted}
                textAlign="center"
              />

              <TouchableOpacity
                style={[styles.verifyBtn, (code.length !== 6 || loading) && styles.btnOff]}
                onPress={handleVerify}
                disabled={code.length !== 6 || loading}
                activeOpacity={0.82}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.verifyBtnText}>{t.verify}</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={() => { setCountdown(RESEND_SECONDS); navigation.goBack(); }}
                disabled={countdown > 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendText, { color: countdown > 0 ? colors.textMuted : '#00C2B2' }]}>
                  {countdown > 0 ? t.resendIn(countdown) : t.resend}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  topSafe: { backgroundColor: 'transparent' },
  backBtn: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  kav: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 100 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  heading: { fontSize: 28, ...ff('800'), color: '#fff', marginBottom: 8 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 },
  card: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  cardInner: { paddingHorizontal: 24, paddingTop: 32 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444', ...ff('500') },
  label: { fontSize: 11, ...ff('700'), letterSpacing: 0, marginBottom: 8 },
  otpInput: {
    height: 64, borderRadius: 16, fontSize: 28, ...ff('700'),
    letterSpacing: 0, marginBottom: 16,
  },
  verifyBtn: {
    height: 58, borderRadius: 16, backgroundColor: DARK_INDIGO,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: DARK_INDIGO, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  btnOff: { opacity: 0.35, shadowOpacity: 0, elevation: 0 },
  verifyBtnText: { color: '#fff', fontSize: 16, ...ff('700') },
  resendBtn: { alignItems: 'center', paddingVertical: 14 },
  resendText: { fontSize: 14, ...ff('600') },
});

// Expose DARK_INDIGO for AuthScreen reuse
OTPScreen.DARK_INDIGO = DARK_INDIGO;

export default OTPScreen;
