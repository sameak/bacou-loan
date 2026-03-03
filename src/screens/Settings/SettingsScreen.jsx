/**
 * SETTINGS SCREEN
 * - Dark mode toggle
 * - Language toggle: English | ខ្មែរ
 * - Sign out
 */

import { Ionicons } from '@expo/vector-icons';
import { signOut, updateProfile } from 'firebase/auth';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebase';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAppLock } from '../../context/AppLockContext';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';

const ACCENT = '#6366F1';

// Phone numbers that have admin access (E.164 and local formats)
const ADMIN_PHONES = ['+85512514608', '+821079274494', '012514608', '01079274494'];
function isAdmin() {
  const phone = auth.currentUser?.phoneNumber ?? '';
  return ADMIN_PHONES.some(p => phone === p || phone.endsWith(p.replace(/^\+?0*/, '')));
}

const T = {
  en: {
    title: 'Settings',
    appearance: 'APPEARANCE',
    darkMode: 'Dark Mode',
    language: 'LANGUAGE',
    english: 'English',
    khmer: 'ខ្មែរ',
    security: 'SECURITY',
    faceId: 'Face ID / Fingerprint',
    pinLock: 'App PIN',
    pinSet: 'Enabled',
    pinNotSet: 'Set up',
    pinRemoveTitle: 'Remove PIN',
    pinRemoveMsg: 'Are you sure you want to remove your PIN?',
    pinRemoveYes: 'Remove',
    pinCancel: 'Cancel',
    pinVerifyTitle: 'Enter Current PIN',
    pinVerifyWrong: 'Incorrect PIN. Try again.',
    account: 'ACCOUNT',
    adminPanel: 'Admin Panel',
    displayName: 'Display Name',
    displayNamePlaceholder: 'Enter your name',
    displayNameEmpty: 'Name cannot be empty',
    displayNameSaved: 'Name updated',
    signedIn: 'Signed In',
    sessions: 'Login History & Devices',
    signOut: 'Sign Out',
    signOutConfirm: 'Are you sure you want to sign out?',
    signOutYes: 'Sign Out',
    signOutCancel: 'Cancel',
    cancel: 'Cancel',
    save: 'Save',
    version: 'Bacou Loan v1.0.0',
  },
  km: {
    title: 'ការកំណត់',
    appearance: 'រូបរាង',
    darkMode: 'របៀបងងឹត',
    language: 'ភាសា',
    english: 'English',
    khmer: 'ខ្មែរ',
    security: 'សុវត្ថិភាព',
    faceId: 'Face ID / ស្នាមម្រាមដៃ',
    pinLock: 'លេខសម្ងាត់កម្មវិធី',
    pinSet: 'បើក',
    pinNotSet: 'កំណត់',
    pinRemoveTitle: 'លុបលេខសម្ងាត់',
    pinRemoveMsg: 'តើអ្នកចង់លុបលេខសម្ងាត់?',
    pinRemoveYes: 'លុប',
    pinCancel: 'បោះបង់',
    pinVerifyTitle: 'បញ្ចូលលេខសម្ងាត់បច្ចុប្បន្ន',
    pinVerifyWrong: 'លេខសម្ងាត់មិនត្រឹមត្រូវ។ ព្យាយាមម្ដងទៀត។',
    account: 'គណនី',
    adminPanel: 'បន្ទះគ្រប់គ្រង',
    displayName: 'ឈ្មោះ',
    displayNamePlaceholder: 'បញ្ចូលឈ្មោះរបស់អ្នក',
    displayNameEmpty: 'ឈ្មោះមិនអាចទទេ',
    displayNameSaved: 'បានធ្វើបច្ចុប្បន្នភាពឈ្មោះ',
    signedIn: 'ចូលកាលបរិច្ឆេទ',
    sessions: 'ប្រវត្តិចូល និងឧបករណ៍',
    signOut: 'ចាកចេញ',
    signOutConfirm: 'តើអ្នកចង់ចាកចេញ?',
    signOutYes: 'ចាកចេញ',
    signOutCancel: 'បោះបង់',
    cancel: 'បោះបង់',
    save: 'រក្សាទុក',
    version: 'Bacou Loan v1.0.0',
  },
};

function formatSignInTime(timeStr) {
  if (!timeStr) return '—';
  const d = new Date(timeStr);
  if (isNaN(d)) return '—';
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date}  ${time}`;
}

const Row = ({ label, right, onPress, colors, last, isDark }) => {
  const { ff } = useLanguage();
  return (
    <TouchableOpacity
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, minHeight: 52 },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={[{ fontSize: 15, lineHeight: 20, ...ff('400'), flex: 1 }, { color: colors.text }]}>{label}</Text>
      {right}
    </TouchableOpacity>
  );
};

const SettingsScreen = ({ navigation }) => {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { language, setLanguage, ff, fi } = useLanguage();
  const styles = useMemo(() => makeStyles(ff), [ff]);
  const { biometricAvailable, biometricEnabled, pinEnabled, toggleBiometric, removePIN, verifyPIN } = useAppLock();
  const t = T[language] || T.en;

  const [signingOut, setSigningOut] = useState(false);
  const [verifyingPIN, setVerifyingPIN] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Auto-submit PIN verify when 4 digits entered
  useEffect(() => {
    if (!verifyingPIN || pinInput.length !== 4) return;
    (async () => {
      const ok = await verifyPIN(pinInput);
      if (!ok) {
        setPinError(true);
        Vibration.vibrate(300);
        setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 650);
      } else {
        setVerifyingPIN(false);
        setPinInput('');
        setPinError(false);
        Alert.alert(t.pinRemoveTitle, t.pinRemoveMsg, [
          { text: t.pinCancel, style: 'cancel' },
          { text: t.pinRemoveYes, style: 'destructive', onPress: removePIN },
        ]);
      }
    })();
  }, [pinInput, verifyingPIN]);

  const handleEditName = () => {
    setNameInput(auth.currentUser?.displayName ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Toast.show({ text: t.displayNameEmpty, type: 'error' });
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
      Toast.show({ text: t.displayNameSaved, type: 'success' });
      setEditingName(false);
    } catch (err) {
      Toast.show({ text: err.message, type: 'error' });
    } finally {
      setSavingName(false);
    }
  };

  const handlePINRow = () => {
    if (pinEnabled) {
      setPinInput('');
      setPinError(false);
      setVerifyingPIN(true);
    } else {
      navigation.navigate('SetPIN');
    }
  };


  const handleSignOut = () => {
    Alert.alert(t.signOut, t.signOutConfirm, [
      { text: t.signOutCancel, style: 'cancel' },
      {
        text: t.signOutYes,
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut(auth);
          } catch (err) {
            Toast.show({ text: err.message, type: 'error' });
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const toggleDark = () => {
    if (themeMode === 'dark') setThemeMode('light');
    else if (themeMode === 'light') setThemeMode('dark');
    else setThemeMode(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t.title}</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.appearance}</Text>
        <GlassCard style={{ marginBottom: 20 }}>
          <Row
            label={t.darkMode}
            colors={colors}
            isDark={isDark}
            last
            right={
              <Switch
                value={isDark}
                onValueChange={toggleDark}
                trackColor={{ false: '#D1D5DB', true: ACCENT + '80' }}
                thumbColor={isDark ? ACCENT : '#fff'}
                ios_backgroundColor="#D1D5DB"
              />
            }
          />
        </GlassCard>

        {/* Language */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.language}</Text>
        <GlassCard style={{ marginBottom: 20 }}>
          <Row
            label={t.english}
            colors={colors}
            isDark={isDark}
            onPress={() => setLanguage('en')}
            right={language === 'en' ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : <View style={{ width: 20 }} />}
          />
          <Row
            label={t.khmer}
            colors={colors}
            isDark={isDark}
            onPress={() => setLanguage('km')}
            last
            right={language === 'km' ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : <View style={{ width: 20 }} />}
          />
        </GlassCard>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.security}</Text>
        <GlassCard style={{ marginBottom: 20 }}>
          {biometricAvailable && (
            <Row
              label={t.faceId}
              colors={colors}
              isDark={isDark}
              last={!true}
              right={
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: '#D1D5DB', true: ACCENT + '80' }}
                  thumbColor={biometricEnabled ? ACCENT : '#fff'}
                  ios_backgroundColor="#D1D5DB"
                />
              }
            />
          )}
          <Row
            label={t.pinLock}
            colors={colors}
            isDark={isDark}
            onPress={handlePINRow}
            last
            right={
              pinEnabled
                ? <Text style={[styles.pinStatus, { color: ACCENT }]}>{t.pinSet}</Text>
                : <Text style={[styles.pinStatus, { color: colors.textMuted }]}>{t.pinNotSet}</Text>
            }
          />
        </GlassCard>

        {/* Account */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.account}</Text>
        <GlassCard style={{ marginBottom: 24 }}>
          {isAdmin() && (
            <Row
              label={t.adminPanel}
              colors={colors}
              isDark={isDark}
              onPress={() => navigation.navigate('Admin')}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              }
            />
          )}
          <Row
            label={t.displayName}
            colors={colors}
            isDark={isDark}
            onPress={handleEditName}
            right={
              <View style={styles.nameRight}>
                <Text style={[styles.nameValue, { color: auth.currentUser?.displayName ? colors.text : colors.textMuted }]} numberOfLines={1}>
                  {auth.currentUser?.displayName || t.displayNamePlaceholder}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            }
          />
          <Row
            label={auth.currentUser?.phoneNumber ?? ''}
            colors={colors}
            isDark={isDark}
            right={<Ionicons name="phone-portrait-outline" size={18} color={colors.textMuted} />}
          />
          <Row
            label={t.signedIn}
            colors={colors}
            isDark={isDark}
            right={
              <Text style={[styles.sessionText, { color: colors.textMuted }]}>
                {formatSignInTime(auth.currentUser?.metadata?.lastSignInTime)}
              </Text>
            }
          />
          <Row
            label={t.sessions}
            colors={colors}
            isDark={isDark}
            onPress={() => navigation.navigate('Sessions')}
            right={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          />
          <Row
            label={t.signOut}
            colors={colors}
            isDark={isDark}
            onPress={handleSignOut}
            last
            right={<Ionicons name="log-out-outline" size={18} color="#EF4444" />}
          />
        </GlassCard>

        <Text style={[styles.version, { color: colors.textMuted }]}>{t.version}</Text>
      </ScrollView>

      {/* PIN Verify Before Remove Modal */}
      <Modal visible={verifyingPIN} transparent animationType="fade">
        <View style={styles.pinModalOverlay}>
          <View style={[styles.pinModalSheet, { backgroundColor: isDark ? '#080810' : '#F0F0F7' }]}>
            {/* Header */}
            <View style={styles.pinModalHeader}>
              <TouchableOpacity onPress={() => setVerifyingPIN(false)} style={styles.pinModalClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.pinModalTitle, { color: colors.text }]}>{t.pinVerifyTitle}</Text>
            </View>

            {/* Dots */}
            <View style={styles.pinDots}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    {
                      backgroundColor: i < pinInput.length
                        ? (pinError ? '#EF4444' : ACCENT)
                        : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.13)'),
                      transform: [{ scale: i < pinInput.length ? 1.15 : 1 }],
                    },
                  ]}
                />
              ))}
            </View>

            {!!pinError && (
              <Text style={[styles.pinErrorText, { color: '#EF4444' }]}>{t.pinVerifyWrong}</Text>
            )}

            {/* Keypad */}
            <View style={styles.pinKeypad}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
                const keyBg     = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.72)';
                const keyBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
                if (key === '') return <View key={i} style={styles.pinKeySlot} />;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.pinKeySlot}
                    activeOpacity={0.65}
                    onPress={() => {
                      if (pinError) return;
                      if (key === '⌫') { setPinInput(p => p.slice(0, -1)); return; }
                      setPinInput(p => (p + key).slice(0, 4));
                    }}
                  >
                    <View style={[styles.pinKeyBtn, { backgroundColor: keyBg, borderColor: keyBorder }]}>
                      {key === '⌫'
                        ? <Ionicons name="backspace-outline" size={22} color={colors.text} />
                        : <Text style={[styles.pinKeyText, { color: colors.text }]}>{key}</Text>
                      }
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Display Name Edit Modal */}
      <Modal visible={editingName} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { backgroundColor: isDark ? colors.surface : '#fff' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEditingName(false)} style={styles.modalSideBtn}>
                <Text style={[styles.modalCancel, { color: colors.textMuted }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t.displayName}</Text>
              <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={styles.modalSideBtn}>
                {savingName
                  ? <ActivityIndicator color={ACCENT} size="small" />
                  : <Text style={[styles.modalSave, { color: ACCENT }]}>{t.save}</Text>
                }
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <View style={[styles.inputWrap, { backgroundColor: isDark ? colors.surface : '#F2F4F8' }]}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text }, fi()]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder={t.displayNamePlaceholder}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, lineHeight: 34, ...ff('800'), letterSpacing: 0 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, lineHeight: 16, ...ff('700'), letterSpacing: 0, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, minHeight: 52 },
  rowLabel: { fontSize: 15, lineHeight: 20, ...ff('400'), flex: 1 },
  sessionText: { fontSize: 13, lineHeight: 18, ...ff('400') },
  pinStatus:   { fontSize: 13, lineHeight: 18, ...ff('600') },
  version: { fontSize: 12, lineHeight: 16, ...ff('400'), textAlign: 'center', marginTop: 8 },
  // PIN verify modal
  pinModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pinModalSheet: { width: '88%', borderRadius: 28, paddingBottom: 32, overflow: 'hidden' },
  pinModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pinModalClose: { padding: 4 },
  pinModalTitle: { flex: 1, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '700', marginRight: 30 },
  pinDots: { flexDirection: 'row', gap: 18, justifyContent: 'center', marginVertical: 28 },
  pinDot: { width: 13, height: 13, borderRadius: 6.5 },
  pinErrorText: { textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 12, marginTop: -12 },
  pinKeypad: { flexDirection: 'row', flexWrap: 'wrap', width: 288, alignSelf: 'center', justifyContent: 'center' },
  pinKeySlot: { width: 96, height: 80, justifyContent: 'center', alignItems: 'center' },
  pinKeyBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  pinKeyText: { fontSize: 26 },

  nameRight: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180 },
  nameValue: { fontSize: 13, lineHeight: 18, ...ff('400') },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalSideBtn: { minWidth: 60 },
  modalCancel: { fontSize: 15, lineHeight: 20, ...ff('400') },
  modalTitle: { fontSize: 16, lineHeight: 21, ...ff('700') },
  modalSave: { fontSize: 15, lineHeight: 20, ...ff('700'), textAlign: 'right' },
  inputWrap: { borderRadius: 12, overflow: 'hidden' },
  nameInput: { height: 50, paddingHorizontal: 14, fontSize: 15, lineHeight: 20 },
});

export default SettingsScreen;
