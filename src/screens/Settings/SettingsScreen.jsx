/**
 * SETTINGS SCREEN
 * - Dark mode toggle
 * - Language toggle: English | ខ្មែរ
 * - Sign out
 */

import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebase';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';

const ACCENT = '#6366F1';

const T = {
  en: {
    title: 'Settings',
    appearance: 'APPEARANCE',
    darkMode: 'Dark Mode',
    language: 'LANGUAGE',
    english: 'English',
    khmer: 'ខ្មែរ',
    account: 'ACCOUNT',
    signedIn: 'Signed In',
    sessions: 'Login History & Devices',
    signOut: 'Sign Out',
    signOutConfirm: 'Are you sure you want to sign out?',
    signOutYes: 'Sign Out',
    signOutCancel: 'Cancel',
    version: 'Bacou Loan v1.0.0',
  },
  km: {
    title: 'ការកំណត់',
    appearance: 'រូបរាង',
    darkMode: 'របៀបងងឹត',
    language: 'ភាសា',
    english: 'English',
    khmer: 'ខ្មែរ',
    account: 'គណនី',
    signedIn: 'ចូលកាលបរិច្ឆេទ',
    sessions: 'ប្រវត្តិចូល និងឧបករណ៍',
    signOut: 'ចាកចេញ',
    signOutConfirm: 'តើអ្នកចង់ចាកចេញ?',
    signOutYes: 'ចាកចេញ',
    signOutCancel: 'បោះបង់',
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

const Row = ({ label, right, onPress, colors, last, isDark }) => (
  <TouchableOpacity
    style={[
      styles.row,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
    ]}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
    {right}
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = T[language] || T.en;

  const [signingOut, setSigningOut] = useState(false);

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

        {/* Account */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.account}</Text>
        <GlassCard style={{ marginBottom: 24 }}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, minHeight: 52 },
  rowLabel: { fontSize: 15, fontWeight: '400', flex: 1 },
  sessionText: { fontSize: 13, fontWeight: '400' },
  version: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});

export default SettingsScreen;
