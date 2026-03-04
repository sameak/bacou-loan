/**
 * APPEARANCE SCREEN — Theme & display settings
 * Phone mockup previews + Automatic toggle (iOS Display & Brightness style)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT = '#00C2B2';

// ── Mini phone mockup ──────────────────────────────────────────────────────────

const PhoneMockup = ({ mode }) => {
  const isLight = mode === 'light';
  const bg       = isLight ? '#EBEBEB'               : '#0B0B10';
  const headerBg = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,28,0.95)';
  const cardBg   = isLight ? 'rgba(255,255,255,0.85)': 'rgba(30,33,50,0.9)';
  const lineHi   = isLight ? '#C8C8CC'               : '#3A3A4C';
  const lineLo   = isLight ? '#E2E2E6'               : '#26263A';
  const border   = isLight ? 'rgba(0,0,0,0.09)'      : 'rgba(255,255,255,0.07)';

  return (
    <View style={[mock.phone, { backgroundColor: bg, borderColor: border }]}>
      <View style={[mock.topBar, { backgroundColor: headerBg, borderBottomColor: border }]}>
        <View style={[mock.topDot, { backgroundColor: lineHi }]} />
        <View style={[mock.topLine, { backgroundColor: lineHi }]} />
      </View>
      <View style={[mock.body, { backgroundColor: bg }]}>
        <View style={[mock.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={[mock.line, { backgroundColor: lineHi, width: '60%' }]} />
          <View style={[mock.line, { backgroundColor: lineLo, width: '40%', marginTop: 4 }]} />
        </View>
        <View style={[mock.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={[mock.line, { backgroundColor: ACCENT, width: '30%' }]} />
          <View style={[mock.line, { backgroundColor: lineLo, width: '65%', marginTop: 4 }]} />
          <View style={[mock.line, { backgroundColor: lineLo, width: '50%', marginTop: 3 }]} />
        </View>
      </View>
      <View style={[mock.bottomBar, { backgroundColor: headerBg, borderTopColor: border }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[mock.navDot, { backgroundColor: i === 2 ? ACCENT : lineHi }]} />
        ))}
      </View>
    </View>
  );
};

const mock = StyleSheet.create({
  phone: {
    width: 120, height: 196, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },
  topBar: {
    height: 28, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, gap: 5, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topDot:    { width: 8, height: 8, borderRadius: 4 },
  topLine:   { flex: 1, height: 5, borderRadius: 3, maxWidth: 44 },
  body:      { flex: 1, padding: 7, gap: 6 },
  card:      { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 8 },
  line:      { height: 5, borderRadius: 3 },
  bottomBar: {
    height: 24, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth,
  },
  navDot: { width: 7, height: 7, borderRadius: 4 },
});

// ── i18n ───────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title:         'Appearance',
    section:       'APPEARANCE',
    light:         'Light',
    dark:          'Dark',
    automatic:     'Automatic',
    automaticDesc: 'Follows your device settings',
  },
  km: {
    title:         'រូបរាង',
    section:       'រូបរាង',
    light:         'ភ្លឺ',
    dark:          'ងងឹត',
    automatic:     'ស្វ័យប្រវត្តិ',
    automaticDesc: 'ដើរតាមការកំណត់ឧបករណ៍',
  },
};

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function AppearanceScreen({ navigation }) {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff), [fs, ff]);

  const isAutomatic    = themeMode === 'system';
  const handleSelect   = (mode) => setThemeMode(mode);
  const handleAutoSwitch = (val) => setThemeMode(val ? 'system' : 'light');

  const muted = colors.textMuted ?? colors.subtext ?? '#8E8E93';
  const cardBg = isDark ? 'rgba(28,33,51,1)' : 'rgba(255,255,255,0.85)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const radioBorder = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)';
  const radioActiveBg = isDark ? '#FFFFFF' : '#1C1C1E';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, ff('700'), { color: colors.text }]}>{t.title}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          <Text style={[styles.sectionLabel, ff('700'), { color: muted }]}>{t.section}</Text>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: cardBg,
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
            shadowOpacity: isDark ? 0.32 : 0.07,
            shadowRadius: isDark ? 14 : 5,
            shadowOffset: { width: 0, height: isDark ? 6 : 2 },
          }]}>

            {/* Mockups */}
            <View style={styles.mockupsRow}>
              {/* Light */}
              <TouchableOpacity style={styles.mockupItem} onPress={() => handleSelect('light')} activeOpacity={0.75}>
                <PhoneMockup mode="light" />
                <Text style={[styles.mockupLabel, ff('500'), { color: colors.text }]}>{t.light}</Text>
                <View style={[styles.radio, { borderColor: radioBorder },
                  themeMode === 'light' && { backgroundColor: radioActiveBg, borderColor: radioActiveBg },
                ]}>
                  {themeMode === 'light' && (
                    <Ionicons name="checkmark" size={13} color={isDark ? '#000' : '#fff'} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Dark */}
              <TouchableOpacity style={styles.mockupItem} onPress={() => handleSelect('dark')} activeOpacity={0.75}>
                <PhoneMockup mode="dark" />
                <Text style={[styles.mockupLabel, ff('500'), { color: colors.text }]}>{t.dark}</Text>
                <View style={[styles.radio, { borderColor: radioBorder },
                  themeMode === 'dark' && { backgroundColor: radioActiveBg, borderColor: radioActiveBg },
                ]}>
                  {themeMode === 'dark' && (
                    <Ionicons name="checkmark" size={13} color={isDark ? '#000' : '#fff'} />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* Automatic row */}
            <View style={styles.autoRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.autoLabel, ff('500'), { color: colors.text }]}>{t.automatic}</Text>
                <Text style={[styles.autoSub,   ff('400'), { color: muted }]}>{t.automaticDesc}</Text>
              </View>
              <Switch
                value={isAutomatic}
                onValueChange={handleAutoSwitch}
                trackColor={{
                  false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                  true:  ACCENT,
                }}
                thumbColor="white"
                ios_backgroundColor={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}
              />
            </View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (fs, ff) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 8, paddingRight: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: fs(22), lineHeight: 28, letterSpacing: 0, paddingLeft: 4 },
  content:     { paddingHorizontal: 16, paddingTop: 4 },

  sectionLabel: { fontSize: fs(12), lineHeight: 16, letterSpacing: 0, marginBottom: 8, marginHorizontal: 4 },

  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000' },
      android: { elevation: 6 },
    }),
  },

  mockupsRow:  { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 16, gap: 20 },
  mockupItem:  { alignItems: 'center', gap: 12 },
  mockupLabel: { fontSize: fs(15), lineHeight: 20, letterSpacing: 0 },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  autoRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  autoLabel: { fontSize: fs(15), lineHeight: 20, letterSpacing: 0 },
  autoSub:   { fontSize: fs(12), lineHeight: 16, letterSpacing: 0, marginTop: 2 },
});
