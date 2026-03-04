/**
 * AUTH SCREEN — Bacou Loan
 * Deep indigo hero + white card layout, phone OTP auth via Firebase reCAPTCHA WebView
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import LogoMark from '../../components/LogoMark';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const NAVBAR_LOGO = require('../../../assets/images/navbar-logo.png');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { firebaseConfig } from '../../services/firebase';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const DARK_INDIGO = '#312e81';

// Allowed phone numbers (E.164 format)
const ALLOWED_PHONES = [
  '+821079274494',  // Korea
  '+85512514608',   // Cambodia
  '+85589496505',   // Cambodia
  '+85512980915',   // Cambodia
];

const COUNTRY_CODES = [
  { code: '+855', flag: '🇰🇭', name: 'ខ្មែរ (Cambodia)' },
  { code: '+82',  flag: '🇰🇷', name: '한국 (Korea)' },
];

const LANG_OPTIONS = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'km', flag: '🇰🇭', label: 'ខ្មែរ' },
];

const getRecaptchaHTML = () => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>body{margin:0;padding:0;}</style>
</head>
<body>
  <div id="recaptcha"></div>
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-auth-compat.js"></script>
  <script>
    try { firebase.initializeApp(${JSON.stringify(firebaseConfig)}); } catch(e) {}
    var recaptchaVerifier = null;
    var recaptchaReady = false;
    var recaptchaRendering = false;
    function setupRecaptcha() {
      if (recaptchaRendering) return;
      recaptchaRendering = true;
      recaptchaReady = false;
      try {
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch(e) {}
          recaptchaVerifier = null;
        }
        document.getElementById('recaptcha').innerHTML = '';
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha', {
          size: 'invisible',
          callback: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha-resolved' })); },
          'expired-callback': function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha-expired' })); }
        });
        recaptchaVerifier.render().then(function() {
          recaptchaReady = true;
          recaptchaRendering = false;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        }).catch(function(e) {
          recaptchaRendering = false;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: e.code || e.message || 'recaptcha-render-failed' }));
        });
      } catch(e) {
        recaptchaRendering = false;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: e.message || 'recaptcha-setup-failed' }));
      }
    }
    setupRecaptcha();
    window.sendOTP = function(phoneNumber) {
      if (!recaptchaReady || !recaptchaVerifier) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'recaptcha-not-ready' }));
        return;
      }
      var provider = new firebase.auth.PhoneAuthProvider();
      provider.verifyPhoneNumber(phoneNumber, recaptchaVerifier)
        .then(function(verificationId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', verificationId: verificationId }));
        })
        .catch(function(error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: error.code || error.message || 'auth/unknown' }));
        });
    };
  </script>
</body>
</html>`;

const ERROR_MAP = {
  'auth/invalid-phone-number': { en: 'Invalid phone number.', km: 'លេខទូរសព្ទមិនត្រឹមត្រូវ។' },
  'auth/too-many-requests': { en: 'Too many attempts. Try again later.', km: 'ព្យាយាមច្រើនពេក។ សូមព្យាយាមម្ដងទៀត។' },
  'recaptcha-not-ready': { en: 'Not ready yet. Please wait a moment.', km: 'មិនទាន់រួចរាល់ទេ។ សូមរង់ចាំ។' },
};

const T = {
  en: {
    heading: 'Bacou Loan',
    sub: 'Manage your loans with ease',
    phoneLabel: 'PHONE NUMBER',
    placeholder: '012-345-678',
    sendCode: 'Send Code',
    terms: 'By continuing, you agree to our Terms of Service and Privacy Policy.',
  },
  km: {
    heading: 'Bacou ប្រាក់កម្ចី',
    sub: 'គ្រប់គ្រងប្រាក់កម្ចីរបស់អ្នកដោយងាយស្រួល',
    phoneLabel: 'លេខទូរសព្ទ',
    placeholder: '012-345-678',
    sendCode: 'ទទួលលេខកូដ',
    terms: 'តាមរយៈការបន្ត អ្នកយល់ព្រមនឹងលក្ខខណ្ឌ និងគោលការណ៍ភាពឯកជន។',
  },
};

const AuthScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, setLanguage, ff } = useLanguage();
  const insets = useSafeAreaInsets();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);

  const [phone, setPhone] = useState('');
  const [countryCodeIdx, setCountryCodeIdx] = useState(0);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [webViewReady, setWebViewReady] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);

  const scrollRef = useRef(null);
  const webViewRef = useRef(null);
  const fullPhoneRef = useRef('');
  const pendingNavRef = useRef(false);
  const otpTimeoutRef = useRef(null);

  const countryCode = COUNTRY_CODES[countryCodeIdx];
  const currentLang = LANG_OPTIONS.find(o => o.code === language) || LANG_OPTIONS[0];
  const phoneReady = phone.replace(/\D/g, '').length >= 8;

  const getErrorMessage = (code) => {
    const mapped = ERROR_MAP[code];
    if (mapped) return mapped[language] || mapped.en;
    return language === 'km' ? 'មានបញ្ហាមួយចំនួន។ ព្យាយាមម្ដងទៀត។' : 'Something went wrong. Please try again.';
  };

  const handleSendOTP = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length < 8) { setError(getErrorMessage('auth/invalid-phone-number')); return; }
    const e164 = countryCode.code + digits;
    fullPhoneRef.current = e164;

    if (!ALLOWED_PHONES.includes(e164)) {
      setError(getErrorMessage('auth/invalid-phone-number'));
      return;
    }

    if (!webViewReady) { setError(getErrorMessage('recaptcha-not-ready')); return; }
    setLoading(true);

    if (!webViewRef.current) { setLoading(false); setError(getErrorMessage('recaptcha-not-ready')); return; }

    clearTimeout(otpTimeoutRef.current);
    otpTimeoutRef.current = setTimeout(() => {
      if (pendingNavRef.current) {
        pendingNavRef.current = false;
        setLoading(false);
        setError(getErrorMessage('auth/too-many-requests'));
      }
    }, 30000);

    pendingNavRef.current = true;
    webViewRef.current.injectJavaScript(`window.sendOTP('${e164}'); true;`);
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setWebViewReady(true);
      } else if (data.type === 'recaptcha-expired') {
        setWebViewReady(false);
        clearTimeout(otpTimeoutRef.current);
        setLoading(false);
        pendingNavRef.current = false;
        setWebViewKey(k => k + 1);
      } else if (data.type === 'success') {
        clearTimeout(otpTimeoutRef.current);
        setLoading(false);
        if (pendingNavRef.current) {
          pendingNavRef.current = false;
          navigation.navigate('OTP', { verificationId: data.verificationId, phone: fullPhoneRef.current });
        }
      } else if (data.type === 'error') {
        clearTimeout(otpTimeoutRef.current);
        setLoading(false);
        pendingNavRef.current = false;
        setError(data.error);
        setWebViewKey(k => k + 1);
      }
    } catch { setLoading(false); }
  };

  const inputBg = isDark ? colors.surface : '#F2F4F8';

  return (
    <View style={[styles.root, { backgroundColor: DARK_INDIGO }]}>
      <StatusBar barStyle="light-content" />

      {/* Hidden reCAPTCHA WebView */}
      <View style={styles.hiddenWebView}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ html: getRecaptchaHTML(), baseUrl: `https://${firebaseConfig.authDomain}` }}
          onMessage={handleWebViewMessage}
          onError={() => { setWebViewReady(false); setWebViewKey(k => k + 1); }}
          onRenderProcessGone={() => { setWebViewReady(false); setWebViewKey(k => k + 1); }}
          onContentProcessDidTerminate={() => { setWebViewReady(false); setWebViewKey(k => k + 1); }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          thirdPartyCookiesEnabled
        />
      </View>

      {/* Top bar */}
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topBar}>
          <View style={{ width: 44 }} />
          <TouchableOpacity
            onPress={() => setShowLangMenu(true)}
            activeOpacity={0.6}
            style={styles.langPill}
          >
            <Text style={styles.langPillFlag}>{currentLang.flag}</Text>
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <LogoMark size={88} />
            <Image source={NAVBAR_LOGO} style={[styles.authLogo, { marginTop: 24 }]} resizeMode="contain" />
            <Text style={[styles.sub, { marginTop: 12 }]}>{t.sub}</Text>
          </View>

          {/* Card */}
          <SafeAreaView edges={['bottom']} style={[styles.card, { backgroundColor: colors.background }]}>
            <View style={styles.cardInner}>
              {!!error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={[styles.phoneLabel, { color: colors.textMuted }]}>{t.phoneLabel}</Text>

              <View style={[styles.phoneBox, { backgroundColor: inputBg }, phoneFocused && styles.phoneBoxFocused]}>
                <TouchableOpacity style={styles.countryBtn} onPress={() => setShowCountryPicker(true)} activeOpacity={0.6}>
                  <Text style={styles.countryFlag}>{countryCode.flag}</Text>
                  <Text style={[styles.countryCode, { color: colors.text }]}>{countryCode.code}</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={[styles.phoneSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB' }]} />
                <TextInput
                  style={[styles.phoneInput, { color: colors.text }]}
                  value={phone}
                  onChangeText={(v) => { setError(''); setPhone(v); }}
                  placeholder={t.placeholder}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  onFocus={() => {
                    setPhoneFocused(true);
                    setTimeout(() => scrollRef.current?.scrollTo({ y: 120, animated: true }), 150);
                  }}
                  onBlur={() => { setPhoneFocused(false); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                />
              </View>

              <TouchableOpacity
                style={[styles.sendBtn, (!phoneReady || loading || !webViewReady) && styles.sendBtnOff]}
                onPress={handleSendOTP}
                activeOpacity={0.82}
                disabled={!phoneReady || loading || !webViewReady}
              >
                {loading || !webViewReady
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendBtnText}>{t.sendCode}</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={[styles.terms, { color: colors.textMuted }]}>{t.terms}</Text>
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language menu */}
      <Modal visible={showLangMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowLangMenu(false)}>
          <View style={[styles.menuCard, { top: insets.top + 50, backgroundColor: colors.surface }]}>
            {LANG_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.code}
                style={[
                  styles.menuItem,
                  i < LANG_OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  language === opt.code && { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                ]}
                onPress={() => { setLanguage(opt.code); setShowLangMenu(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemFlag}>{opt.flag}</Text>
                <Text style={[styles.menuItemLabel, { color: colors.text }, language === opt.code && ff('700')]}>{opt.label}</Text>
                {language === opt.code && <Ionicons name="checkmark" size={16} color={colors.text} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Country code picker */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCountryPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.pickerHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={item => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerRow,
                    index < COUNTRY_CODES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                    countryCode.code === item.code && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                  ]}
                  onPress={() => { setCountryCodeIdx(COUNTRY_CODES.indexOf(item)); setShowCountryPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerFlag}>{item.flag}</Text>
                  <Text style={[styles.pickerName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.pickerDialCode, { color: colors.textMuted }]}>{item.code}</Text>
                  {countryCode.code === item.code && <Ionicons name="checkmark" size={18} color={colors.text} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  hiddenWebView: { position: 'absolute', left: -350, top: 0, width: 300, height: 300 },
  topSafe: { backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  langPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)' },
  langPillFlag: { fontSize: 18 },
  kav: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 80, paddingBottom: 140 },
  authLogo: { height: 56, width: Math.round(56 * 256 / 144) },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 },
  card: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  cardInner: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 8 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444', ...ff('500'), lineHeight: 18 },
  phoneLabel: { fontSize: 11, ...ff('700'), letterSpacing: 0, marginBottom: 8 },
  phoneBox: { flexDirection: 'row', alignItems: 'center', height: 58, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', marginBottom: 12, overflow: 'hidden' },
  phoneBoxFocused: { borderColor: 'rgba(99,102,241,0.35)' },
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, height: '100%' },
  countryFlag: { fontSize: 20 },
  countryCode: { fontSize: 14, ...ff('700') },
  phoneSep: { width: 1, height: 22 },
  phoneInput: { flex: 1, height: '100%', paddingHorizontal: 14, fontSize: 16, ...ff('500') },
  sendBtn: {
    height: 58, borderRadius: 16, backgroundColor: DARK_INDIGO,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: DARK_INDIGO, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  sendBtnOff: { opacity: 0.35, shadowOpacity: 0, elevation: 0 },
  sendBtnText: { color: '#fff', fontSize: 16, ...ff('700') },
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 20 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuCard: { position: 'absolute', right: 16, borderRadius: 16, overflow: 'hidden', minWidth: 170, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 28 }, android: { elevation: 10 } }) },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  menuItemFlag: { fontSize: 20 },
  menuItemLabel: { flex: 1, fontSize: 15, ...ff('500') },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', paddingBottom: 24 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  pickerFlag: { fontSize: 26 },
  pickerName: { flex: 1, fontSize: 15, ...ff('500') },
  pickerDialCode: { fontSize: 14, ...ff('700') },
});

export default AuthScreen;
