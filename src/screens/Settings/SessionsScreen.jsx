/**
 * SESSIONS SCREEN
 * Login history + active devices for the current account.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import {
  getOrCreateSessionId,
  listenSessions,
  removeSession,
} from '../../services/sessionService';

const ACCENT = '#6366F1';

const T = {
  en: {
    title: 'Sessions',
    subtitle: 'Login history & active devices',
    thisDevice: 'This Device',
    active: 'ACTIVE DEVICES',
    history: 'LOGIN HISTORY',
    loginTime: 'First login',
    lastSeen: 'Last active',
    remove: 'Remove',
    removeConfirm: 'Remove this device from your session history?',
    removeYes: 'Remove',
    removeCancel: 'Cancel',
    noSessions: 'No sessions found.',
    platform: { ios: 'iOS', android: 'Android' },
  },
  km: {
    title: 'វគ្គ',
    subtitle: 'ប្រវត្តិការចូល និងឧបករណ៍ដែលសកម្ម',
    thisDevice: 'ឧបករណ៍នេះ',
    active: 'ឧបករណ៍ដែលសកម្ម',
    history: 'ប្រវត្តិការចូល',
    loginTime: 'ចូលដំបូង',
    lastSeen: 'សកម្មចុងក្រោយ',
    remove: 'លុប',
    removeConfirm: 'លុបឧបករណ៍នេះចេញពីប្រវត្តិ?',
    removeYes: 'លុប',
    removeCancel: 'បោះបង់',
    noSessions: 'មិនមានវគ្គ។',
    platform: { ios: 'iOS', android: 'Android' },
  },
};

function timeAgo(ts) {
  if (!ts?.seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts.seconds);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
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

// A device is "recently active" if last seen within 30 days
function isRecentlyActive(ts) {
  if (!ts?.seconds) return false;
  return Date.now() / 1000 - ts.seconds < 30 * 24 * 3600;
}

function deviceIcon(platform) {
  if (platform === 'ios') return 'phone-portrait-outline';
  return 'logo-android';
}

export default function SessionsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const t = T[language] || T.en;

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    getOrCreateSessionId().then(setCurrentSessionId);
  }, []);

  useEffect(() => {
    const unsub = listenSessions(data => {
      setSessions(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleRemove = (session) => {
    if (session.sessionId === currentSessionId) return; // can't remove self
    Alert.alert(t.remove, t.removeConfirm, [
      { text: t.removeCancel, style: 'cancel' },
      {
        text: t.removeYes,
        style: 'destructive',
        onPress: async () => {
          setRemoving(session.sessionId);
          try {
            await removeSession(session.sessionId);
          } catch (e) {
            console.warn(e);
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);
  };

  const activeSessions = sessions.filter(s => isRecentlyActive(s.lastSeen));
  const historySessions = sessions.filter(s => !isRecentlyActive(s.lastSeen));

  const renderSession = (session, last) => {
    const isCurrent = session.sessionId === currentSessionId;
    const isRemovingThis = removing === session.sessionId;

    return (
      <View
        key={session.id}
        style={[
          styles.sessionRow,
          !last && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)' }]}>
          <Ionicons name={deviceIcon(session.platform)} size={20} color={ACCENT} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
              {session.deviceModel || 'Unknown Device'}
            </Text>
            {isCurrent && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t.thisDevice}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t.platform[session.platform] || session.platform}
            {session.osVersion ? ` ${session.osVersion}` : ''}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t.loginTime}: {formatDate(session.loginTime)}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t.lastSeen}: {timeAgo(session.lastSeen)}
          </Text>
        </View>

        {/* Remove button — only for other devices */}
        {!isCurrent && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemove(session)}
            disabled={isRemovingThis}
            activeOpacity={0.7}
          >
            {isRemovingThis
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Ionicons name="trash-outline" size={18} color="#EF4444" />
            }
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.subtitle}</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>{t.noSessions}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Active devices */}
          {activeSessions.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.active}</Text>
              <GlassCard style={{ marginBottom: 20 }}>
                {activeSessions.map((s, i) => renderSession(s, i === activeSessions.length - 1))}
              </GlassCard>
            </>
          )}

          {/* Older history */}
          {historySessions.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.history}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 4 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '400', marginTop: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  deviceName: { fontSize: 15, fontWeight: '600' },
  badge: {
    backgroundColor: ACCENT,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 6 },
});
