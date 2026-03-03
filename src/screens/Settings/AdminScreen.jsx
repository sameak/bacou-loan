/**
 * ADMIN PANEL
 * Master-only view: all users' online status, devices, and recent activity.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import { listenAllSessions, removeSession } from '../../services/sessionService';
import { auth } from '../../services/firebase';

const ACCENT = '#6366F1';

// ── Status helpers ─────────────────────────────────────────────────────────────

function getOnlineStatus(lastSeen) {
  if (!lastSeen?.seconds) return 'offline';
  const diff = Date.now() / 1000 - lastSeen.seconds;
  if (diff < 5 * 60)  return 'online';
  if (diff < 60 * 60) return 'away';
  return 'offline';
}

const STATUS_COLOR  = { online: '#10B981', away: '#F59E0B', offline: '#9CA3AF' };
const STATUS_LABEL  = { online: 'Online', away: 'Away', offline: 'Offline' };
const STATUS_LABEL_KM = { online: 'អនឡាញ', away: 'ថ្មី', offline: 'គ្មានអ៊ីនធឺណិត' };

function timeAgo(ts) {
  if (!ts?.seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts.seconds);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
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

// ── Translations ───────────────────────────────────────────────────────────────

const T = {
  en: {
    title:        'Admin Panel',
    subtitle:     'All users · devices · activity',
    userStatus:   'USER STATUS',
    allDevices:   'ALL DEVICES',
    recentActivity: 'RECENT ACTIVITY',
    thisDevice:   'This Device',
    lastSeen:     'Last seen',
    loginTime:    'First login',
    noSessions:   'No sessions yet.',
    noActivity:   'No activity yet.',
    remove:       'Remove',
    removeConfirm:'Remove this device session?',
    removeYes:    'Remove',
    removeCancel: 'Cancel',
    createdLoan:  'Created loan',
    editedLoan:   'Edited loan',
    createdBorrower: 'Added borrower',
    editedBorrower:  'Edited borrower',
    for:          'for',
    by:           'by',
    secNone:      'No lock',
    secPin:       'PIN',
    secFaceId:    'Face ID',
    secFingerprint: 'Fingerprint',
  },
  km: {
    title:        'បន្ទះគ្រប់គ្រង',
    subtitle:     'អ្នកប្រើទាំងអស់ · ឧបករណ៍ · សកម្មភាព',
    userStatus:   'ស្ថានភាពអ្នកប្រើ',
    allDevices:   'ឧបករណ៍ទាំងអស់',
    recentActivity: 'សកម្មភាពថ្មី',
    thisDevice:   'ឧបករណ៍នេះ',
    lastSeen:     'ឃើញចុងក្រោយ',
    loginTime:    'ចូលដំបូង',
    noSessions:   'មិនទាន់មានវគ្គ។',
    noActivity:   'មិនទាន់មានសកម្មភាព។',
    remove:       'លុប',
    removeConfirm:'លុបវគ្គឧបករណ៍នេះ?',
    removeYes:    'លុប',
    removeCancel: 'បោះបង់',
    createdLoan:  'បង្កើតប្រាក់កម្ចី',
    editedLoan:   'កែប្រាក់កម្ចី',
    createdBorrower: 'បន្ថែមអ្នកខ្ចី',
    editedBorrower:  'កែអ្នកខ្ចី',
    for:          'សម្រាប់',
    by:           'ដោយ',
    secNone:      'គ្មានសោ',
    secPin:       'PIN',
    secFaceId:    'Face ID',
    secFingerprint: 'ស្នាមម្រាមដៃ',
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff), [fs, ff]);

  const { loans, borrowers } = useData();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [removing, setRemoving] = useState(null);

  const currentSessionUid = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = listenAllSessions(
      data => { setSessions(data); setLoading(false); },
      ()   => setLoading(false),
    );
    return unsub;
  }, []);

  // ── Group sessions by uid → one "user card" per uid ─────────────────────────
  const userGroups = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      if (!map[s.uid]) map[s.uid] = [];
      map[s.uid].push(s);
    }
    // Sort each group newest first; sort users by most-recent lastSeen
    return Object.entries(map)
      .map(([uid, sess]) => ({
        uid,
        displayName: sess[0]?.displayName || 'Unknown',
        sessions: sess.sort((a, b) => (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0)),
        latestSeen: sess[0]?.lastSeen,
      }))
      .sort((a, b) => (b.latestSeen?.seconds ?? 0) - (a.latestSeen?.seconds ?? 0));
  }, [sessions]);

  // ── Recent activity feed ─────────────────────────────────────────────────────
  const activityFeed = useMemo(() => {
    const items = [];

    for (const loan of loans) {
      if (loan.createdAt) {
        items.push({
          key: `loan-created-${loan.id}`,
          type: 'createdLoan',
          subject: loan.borrowerName,
          byName: loan.createdByName,
          ts: loan.createdAt,
        });
      }
      if (loan.updatedAt) {
        items.push({
          key: `loan-edited-${loan.id}`,
          type: 'editedLoan',
          subject: loan.borrowerName,
          byName: loan.updatedByName,
          ts: loan.updatedAt,
        });
      }
    }

    for (const b of borrowers) {
      if (b.createdAt) {
        items.push({
          key: `borrower-created-${b.id}`,
          type: 'createdBorrower',
          subject: b.name,
          byName: b.createdByName,
          ts: b.createdAt,
        });
      }
      if (b.updatedAt) {
        items.push({
          key: `borrower-edited-${b.id}`,
          type: 'editedBorrower',
          subject: b.name,
          byName: b.updatedByName,
          ts: b.updatedAt,
        });
      }
    }

    return items
      .filter(i => i.byName)
      .sort((a, b) => (b.ts?.seconds ?? 0) - (a.ts?.seconds ?? 0))
      .slice(0, 30);
  }, [loans, borrowers]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleRemove = (session) => {
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

  // ── Render helpers ────────────────────────────────────────────────────────────

  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' };

  const renderUserCard = (group) => {
    const status = getOnlineStatus(group.latestSeen);
    const statusColor = STATUS_COLOR[status];
    const statusLabel = language === 'km' ? STATUS_LABEL_KM[status] : STATUS_LABEL[status];
    const isMe = group.uid === currentSessionUid;

    return (
      <View key={group.uid} style={[styles.userCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
        {/* Avatar + name */}
        <View style={styles.userCardTop}>
          <View style={[styles.avatar, { backgroundColor: ACCENT + '20' }]}>
            <Text style={[styles.avatarText, { color: ACCENT, fontSize: fs(16) }]}>
              {(group.displayName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.text, fontSize: fs(15) }]} numberOfLines={1}>
                {group.displayName}
              </Text>
              {isMe && (
                <View style={[styles.meBadge, { backgroundColor: ACCENT }]}>
                  <Text style={[styles.meBadgeText, { fontSize: fs(10) }]}>YOU</Text>
                </View>
              )}
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor, fontSize: fs(12) }]}>{statusLabel}</Text>
              <Text style={[styles.statusTime, { color: colors.textMuted, fontSize: fs(12) }]}>
                · {timeAgo(group.latestSeen)}
              </Text>
            </View>
          </View>
        </View>

        {/* Device list for this user */}
        {group.sessions.map((s, i) => {
          const icon = s.platform === 'ios' ? 'phone-portrait-outline' : 'logo-android';
          const isRemoving = removing === s.sessionId;
          return (
            <View key={s.id} style={[styles.deviceRow, i === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Ionicons name={icon} size={16} color={colors.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.deviceName, { color: colors.text, fontSize: fs(13) }]}>{s.deviceModel || 'Unknown'}</Text>
                <Text style={[styles.deviceMeta, { color: colors.textMuted, fontSize: fs(11) }]}>
                  {s.platform === 'ios' ? 'iOS' : 'Android'} {s.osVersion}  ·  {t.lastSeen}: {timeAgo(s.lastSeen)}
                </Text>
                <Text style={[styles.deviceMeta, { color: colors.textMuted, fontSize: fs(11) }]}>
                  {t.loginTime}: {formatDate(s.loginTime)}
                </Text>
                {/* Security method badges */}
                <View style={styles.secBadgeRow}>
                  {s.biometricEnabled ? (
                    <View style={[styles.secBadge, { backgroundColor: '#6366F118' }]}>
                      <Ionicons
                        name={s.biometricType === 'faceId' ? 'scan-outline' : 'finger-print'}
                        size={11}
                        color={ACCENT}
                      />
                      <Text style={[styles.secBadgeText, { color: ACCENT, fontSize: fs(10) }]}>
                        {s.biometricType === 'faceId' ? t.secFaceId : t.secFingerprint}
                      </Text>
                    </View>
                  ) : null}
                  {s.pinEnabled ? (
                    <View style={[styles.secBadge, { backgroundColor: '#10B98118' }]}>
                      <Ionicons name="keypad-outline" size={11} color="#10B981" />
                      <Text style={[styles.secBadgeText, { color: '#10B981', fontSize: fs(10) }]}>{t.secPin}</Text>
                    </View>
                  ) : null}
                  {!s.biometricEnabled && !s.pinEnabled && s.hasOwnProperty('pinEnabled') ? (
                    <View style={[styles.secBadge, { backgroundColor: '#EF444418' }]}>
                      <Ionicons name="lock-open-outline" size={11} color="#EF4444" />
                      <Text style={[styles.secBadgeText, { color: '#EF4444', fontSize: fs(10) }]}>{t.secNone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity onPress={() => handleRemove(s)} disabled={isRemoving} style={styles.removeBtn} activeOpacity={0.7}>
                {isRemoving
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <Ionicons name="trash-outline" size={16} color="#EF4444" />
                }
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  const renderActivityItem = (item, last) => {
    const iconMap = {
      createdLoan:     { name: 'add-circle-outline',  color: '#10B981' },
      editedLoan:      { name: 'pencil-outline',       color: ACCENT },
      createdBorrower: { name: 'person-add-outline',   color: '#F59E0B' },
      editedBorrower:  { name: 'person-outline',       color: '#8B5CF6' },
    };
    const ic = iconMap[item.type] ?? { name: 'ellipse-outline', color: colors.textMuted };
    const label = t[item.type] ?? item.type;

    return (
      <View key={item.key} style={[styles.activityRow, !last && divider]}>
        <View style={[styles.activityIcon, { backgroundColor: ic.color + '18' }]}>
          <Ionicons name={ic.name} size={16} color={ic.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.activityLabel, { color: colors.text, fontSize: fs(13) }]} numberOfLines={1}>
            {label} {t.for} <Text style={{ ...ff('600') }}>{item.subject}</Text>
          </Text>
          <Text style={[styles.activityMeta, { color: colors.textMuted, fontSize: fs(11) }]}>
            {t.by} {item.byName}  ·  {timeAgo(item.ts)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: fs(24) }]}>{t.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs(13) }]}>{t.subtitle}</Text>
          </View>
          {/* Crown icon for master */}
          <View style={[styles.crownWrap, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#F59E0B" />
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* ── USER STATUS ─────────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: fs(11) }]}>{t.userStatus}</Text>
          {userGroups.length === 0 ? (
            <GlassCard style={{ marginBottom: 20 }}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: fs(14) }]}>{t.noSessions}</Text>
            </GlassCard>
          ) : (
            <View style={{ marginBottom: 20, gap: 10 }}>
              {userGroups.map(renderUserCard)}
            </View>
          )}

          {/* ── RECENT ACTIVITY ─────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: fs(11) }]}>{t.recentActivity}</Text>
          <GlassCard style={{ marginBottom: 32 }}>
            {activityFeed.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: fs(14) }]}>{t.noActivity}</Text>
            ) : (
              activityFeed.map((item, i) => renderActivityItem(item, i === activityFeed.length - 1))
            )}
          </GlassCard>

        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (fs, ff) => StyleSheet.create({
  root:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 8 },
  backBtn: { padding: 4 },
  title:   { ...ff('800'), lineHeight: 30, letterSpacing: 0 },
  subtitle:{ marginTop: 1, lineHeight: 18, ...ff('400') },
  crownWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...ff('700'), lineHeight: 15, letterSpacing: 0, marginBottom: 8 },
  emptyText: { padding: 20, textAlign: 'center', ...ff('400'), lineHeight: 20 },

  // User card
  userCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 0 },
  userCardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { ...ff('800'), lineHeight: 22, textAlign: 'center' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { ...ff('700'), lineHeight: 20, flex: 1 },
  meBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  meBadgeText: { color: '#fff', ...ff('700'), lineHeight: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { ...ff('600'), lineHeight: 16 },
  statusTime: { ...ff('400'), lineHeight: 16 },

  // Device row
  deviceRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, gap: 0 },
  deviceName: { ...ff('600'), lineHeight: 18, marginBottom: 2 },
  deviceMeta: { ...ff('400'), lineHeight: 15 },
  secBadgeRow: { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  secBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  secBadgeText: { ...ff('600'), lineHeight: 14 },
  removeBtn: { padding: 6, flexShrink: 0, marginTop: -2 },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  activityIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityLabel: { ...ff('400'), lineHeight: 18, marginBottom: 2 },
  activityMeta: { ...ff('400'), lineHeight: 15 },
});
