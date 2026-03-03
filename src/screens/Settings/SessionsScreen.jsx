/**
 * SESSIONS SCREEN
 * Login history + active devices for the current account.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import {
  getOrCreateSessionId,
  listenSessions,
  recordSession,
  removeSession,
} from '../../services/sessionService';

const ACCENT = '#6366F1';

const T = {
  en: {
    title:         'Sessions',
    subtitle:      'Login history & active devices',
    thisDevice:    'This Device',
    active:        'ACTIVE DEVICES',
    history:       'LOGIN HISTORY',
    loginTime:     'First login',
    lastSeen:      'Last active',
    remove:        'Remove',
    removeConfirm: 'Remove this device from session history?',
    removeYes:     'Remove',
    removeCancel:  'Cancel',
    noSessions:    'No sessions found.',
    ios:           'iOS',
    android:       'Android',
    justNow:       'Just now',
  },
  km: {
    title:         'វគ្គ',
    subtitle:      'ប្រវត្តិការចូល និងឧបករណ៍សកម្ម',
    thisDevice:    'ឧបករណ៍នេះ',
    active:        'ឧបករណ៍សកម្ម',
    history:       'ប្រវត្តិការចូល',
    loginTime:     'ចូលដំបូង',
    lastSeen:      'សកម្មចុងក្រោយ',
    remove:        'លុប',
    removeConfirm: 'លុបឧបករណ៍នេះចេញពីប្រវត្តិ?',
    removeYes:     'លុប',
    removeCancel:  'បោះបង់',
    noSessions:    'មិនមានវគ្គ។',
    ios:           'iOS',
    android:       'Android',
    justNow:       'ទើបតែ',
  },
};

function timeAgo(ts, t) {
  if (!ts?.seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts.seconds);
  if (diff < 60)    return t.justNow;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDate(ts) {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isRecentlyActive(ts) {
  if (!ts?.seconds) return false;
  return Date.now() / 1000 - ts.seconds < 30 * 24 * 3600;
}

export default function SessionsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff), [ff]);

  const [sessions,          setSessions]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [currentSessionId,  setCurrentSessionId]  = useState(null);
  const [removing,          setRemoving]          = useState(null);

  useEffect(() => {
    recordSession().then(() => getOrCreateSessionId().then(setCurrentSessionId));
  }, []);

  useEffect(() => {
    const unsub = listenSessions(
      data => { setSessions(data); setLoading(false); },
      ()   => setLoading(false),
    );
    return unsub;
  }, []);

  const handleRemove = (session) => {
    if (session.sessionId === currentSessionId) return;
    Alert.alert(t.remove, t.removeConfirm, [
      { text: t.removeCancel, style: 'cancel' },
      {
        text: t.removeYes,
        style: 'destructive',
        onPress: async () => {
          setRemoving(session.sessionId);
          try { await removeSession(session.sessionId); }
          catch (e) { console.warn(e); }
          finally   { setRemoving(null); }
        },
      },
    ]);
  };

  const activeSessions  = sessions.filter(s =>  isRecentlyActive(s.lastSeen));
  const historySessions = sessions.filter(s => !isRecentlyActive(s.lastSeen));

  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' };

  const renderSession = (session, last) => {
    const isCurrent      = session.sessionId === currentSessionId;
    const isRemovingThis = removing === session.sessionId;
    const platformLabel  = session.platform === 'ios' ? t.ios : t.android;
    const icon           = session.platform === 'ios' ? 'phone-portrait-outline' : 'logo-android';

    return (
      <View key={session.id} style={[styles.row, !last && divider]}>
        {/* Device icon */}
        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.09)' }]}>
          <Ionicons name={icon} size={20} color={ACCENT} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.deviceName, { color: colors.text, fontSize: fs(15) }]} numberOfLines={1}>
              {session.deviceModel || 'Unknown'}
            </Text>
            {isCurrent && (
              <View style={styles.badge}>
                <Text style={[styles.badgeText, { fontSize: fs(11) }]}>{t.thisDevice}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.meta, { color: colors.textMuted, fontSize: fs(12) }]}>
            {platformLabel}{session.osVersion ? ` ${session.osVersion}` : ''}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted, fontSize: fs(12) }]}>
            {t.loginTime}: {formatDate(session.loginTime)}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted, fontSize: fs(12) }]}>
            {t.lastSeen}: {timeAgo(session.lastSeen, t)}
          </Text>
        </View>

        {/* Remove */}
        {!isCurrent && (
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(session)} disabled={isRemovingThis} activeOpacity={0.7}>
            {isRemovingThis
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Ionicons name="trash-outline" size={18} color="#EF4444" />
            }
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const sectionTitleStyle = (extra = {}) => [
    styles.sectionTitle,
    { color: colors.textMuted, fontSize: fs(11) },
    extra,
  ];

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: fs(24) }]}>{t.title}</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted, fontSize: fs(13) }]}>{t.subtitle}</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted, fontSize: fs(15) }}>{t.noSessions}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {activeSessions.length > 0 && (
            <>
              <Text style={sectionTitleStyle()}>{t.active}</Text>
              <GlassCard style={{ marginBottom: 20 }}>
                {activeSessions.map((s, i) => renderSession(s, i === activeSessions.length - 1))}
              </GlassCard>
            </>
          )}
          {historySessions.length > 0 && (
            <>
              <Text style={sectionTitleStyle()}>{t.history}</Text>
              <GlassCard style={{ marginBottom: 20 }}>
                {historySessions.map((s, i) => renderSession(s, i === historySessions.length - 1))}
              </GlassCard>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (ff) => StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 4 },
  backBtn:   { padding: 4 },
  title:     { ...ff('800'), lineHeight: 30, letterSpacing: 0 },
  headerSub: { marginTop: 1, lineHeight: 18, ...ff('400') },
  content:   { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  sectionTitle: { ...ff('700'), lineHeight: 15, marginBottom: 8 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  iconWrap:  { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info:      { flex: 1 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  deviceName:{ ...ff('600'), lineHeight: 20 },
  badge:     { backgroundColor: ACCENT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', ...ff('700'), lineHeight: 15 },
  meta:      { marginTop: 2, lineHeight: 18, ...ff('400') },
  removeBtn: { padding: 6, flexShrink: 0 },
});
