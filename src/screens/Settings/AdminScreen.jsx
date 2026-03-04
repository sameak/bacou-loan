/**
 * ADMIN DASHBOARD
 * Master-only: portfolio KPIs, outstanding capital, status breakdown,
 * per-user contribution stats, team online status, devices, and activity feed.
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

const ACCENT = '#00C2B2';

// ── Status helpers ─────────────────────────────────────────────────────────────

function getOnlineStatus(lastSeen) {
  if (!lastSeen?.seconds) return 'offline';
  const diff = Date.now() / 1000 - lastSeen.seconds;
  if (diff < 5 * 60)  return 'online';
  if (diff < 60 * 60) return 'away';
  return 'offline';
}

const STATUS_COLOR = { online: '#10B981', away: '#F59E0B', offline: '#9CA3AF' };
const STATUS_LABEL = { online: 'Online', away: 'Away', offline: 'Offline' };
const STATUS_LABEL_KM = { online: 'អនឡាញ', away: 'ថ្មីៗ', offline: 'គ្មានអ៊ីនធឺណិត' };

function timeAgo(ts) {
  if (!ts?.seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts.seconds);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Translations ───────────────────────────────────────────────────────────────

const T = {
  en: {
    title:           'Admin Dashboard',
    subtitle:        'Team · Devices · Activity',
    teamStatus:      'TEAM STATUS',
    recentActivity:  'RECENT ACTIVITY',
    active:          'Active',
    overdue:         'Overdue',
    loansCreated:    'loans',
    borrowersAdded:  'clients',
    thisDevice:      'This Device',
    lastSeen:        'Last seen',
    noSessions:      'No sessions yet.',
    noActivity:      'No activity yet.',
    remove:          'Remove',
    removeConfirm:   'Remove this device session?',
    removeYes:       'Remove',
    removeCancel:    'Cancel',
    createdLoan:     'Created loan',
    editedLoan:      'Edited loan',
    createdBorrower: 'Added borrower',
    editedBorrower:  'Edited borrower',
    for:             'for',
    by:              'by',
    secNone:         'No lock',
    secPin:          'PIN',
    secFaceId:       'Face ID',
    secFingerprint:  'Fingerprint',
    devices:         'devices',
    online:          'online now',
  },
  km: {
    title:           'ផ្ទាំងគ្រប់គ្រង',
    subtitle:        'ក្រុម · ឧបករណ៍ · សកម្មភាព',
    teamStatus:      'ស្ថានភាពក្រុម',
    recentActivity:  'សកម្មភាពថ្មី',
    active:          'ដំណើរការ',
    overdue:         'ហួសកំណត់',
    loansCreated:    'ប្រាក់កម្ចី',
    borrowersAdded:  'អតិថិជន',
    thisDevice:      'ឧបករណ៍នេះ',
    lastSeen:        'ឃើញចុងក្រោយ',
    noSessions:      'មិនទាន់មានវគ្គ។',
    noActivity:      'មិនទាន់មានសកម្មភាព។',
    remove:          'លុប',
    removeConfirm:   'លុបវគ្គឧបករណ៍នេះ?',
    removeYes:       'លុប',
    removeCancel:    'បោះបង់',
    createdLoan:     'បង្កើតប្រាក់កម្ចី',
    editedLoan:      'កែប្រាក់កម្ចី',
    createdBorrower: 'បន្ថែមអតិថិជន',
    editedBorrower:  'កែអតិថិជន',
    for:             'សម្រាប់',
    by:              'ដោយ',
    secNone:         'គ្មានសោ',
    secPin:          'PIN',
    secFaceId:       'Face ID',
    secFingerprint:  'ស្នាមម្រាមដៃ',
    devices:         'ឧបករណ៍',
    online:          'កំពុងអនឡាញ',
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

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = listenAllSessions(
      data => { setSessions(data); setLoading(false); },
      ()   => setLoading(false),
    );
    return unsub;
  }, []);

  // ── Per-user stats (by createdBy uid) ────────────────────────────────────────
  const perUser = useMemo(() => {
    const map = {};
    for (const l of loans) {
      if (!l.createdBy) continue;
      if (!map[l.createdBy]) map[l.createdBy] = { loans: 0, borrowers: 0, active: 0, overdue: 0 };
      map[l.createdBy].loans++;
      if (l.status === 'active')  map[l.createdBy].active++;
      if (l.status === 'overdue') map[l.createdBy].overdue++;
    }
    for (const b of borrowers) {
      if (!b.createdBy) continue;
      if (!map[b.createdBy]) map[b.createdBy] = { loans: 0, borrowers: 0, active: 0, overdue: 0 };
      map[b.createdBy].borrowers++;
    }
    return map;
  }, [loans, borrowers]);

  // ── Group sessions by uid ─────────────────────────────────────────────────────
  const userGroups = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      if (!map[s.uid]) map[s.uid] = [];
      map[s.uid].push(s);
    }
    return Object.entries(map)
      .map(([uid, sess]) => ({
        uid,
        displayName: sess[0]?.displayName || 'Unknown',
        sessions: sess.sort((a, b) => (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0)),
        latestSeen: sess[0]?.lastSeen,
      }))
      .sort((a, b) => (b.latestSeen?.seconds ?? 0) - (a.latestSeen?.seconds ?? 0));
  }, [sessions]);

  const onlineCount = useMemo(
    () => userGroups.filter(g => getOnlineStatus(g.latestSeen) === 'online').length,
    [userGroups],
  );

  // ── Activity feed ─────────────────────────────────────────────────────────────
  const activityFeed = useMemo(() => {
    const items = [];
    for (const loan of loans) {
      if (loan.createdAt) items.push({ key: `lc-${loan.id}`, type: 'createdLoan', subject: loan.borrowerName, byName: loan.createdByName, ts: loan.createdAt });
      if (loan.updatedAt) items.push({ key: `le-${loan.id}`, type: 'editedLoan',  subject: loan.borrowerName, byName: loan.updatedByName,  ts: loan.updatedAt });
    }
    for (const b of borrowers) {
      if (b.createdAt) items.push({ key: `bc-${b.id}`, type: 'createdBorrower', subject: b.name, byName: b.createdByName, ts: b.createdAt });
      if (b.updatedAt) items.push({ key: `be-${b.id}`, type: 'editedBorrower',  subject: b.name, byName: b.updatedByName,  ts: b.updatedAt });
    }
    return items
      .filter(i => i.byName)
      .sort((a, b) => (b.ts?.seconds ?? 0) - (a.ts?.seconds ?? 0))
      .slice(0, 30);
  }, [loans, borrowers]);

  // ── Remove session ────────────────────────────────────────────────────────────
  const handleRemove = (session) => {
    Alert.alert(t.remove, t.removeConfirm, [
      { text: t.removeCancel, style: 'cancel' },
      {
        text: t.removeYes, style: 'destructive',
        onPress: async () => {
          setRemoving(session.sessionId);
          try { await removeSession(session.sessionId); }
          catch (e) { console.warn(e); }
          finally   { setRemoving(null); }
        },
      },
    ]);
  };

  const hairline = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' };

  // ── Render: user card ─────────────────────────────────────────────────────────
  const renderUserCard = (group) => {
    const status      = getOnlineStatus(group.latestSeen);
    const statusColor = STATUS_COLOR[status];
    const statusLabel = language === 'km' ? STATUS_LABEL_KM[status] : STATUS_LABEL[status];
    const isMe        = group.uid === myUid;
    const uStats      = perUser[group.uid] ?? { loans: 0, borrowers: 0, active: 0, overdue: 0 };

    return (
      <GlassCard key={group.uid} style={{ marginBottom: 10 }}>
        {/* Avatar + name + status */}
        <View style={styles.userTop}>
          <View style={[styles.avatar, { backgroundColor: ACCENT + '22' }]}>
            <Text style={[styles.avatarText, ff('800'), { color: ACCENT, fontSize: fs(17), lineHeight: 22 }]}>
              {(group.displayName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, ff('700'), { color: colors.text, fontSize: fs(15), lineHeight: 20 }]} numberOfLines={1}>
                {group.displayName}
              </Text>
              {isMe && (
                <View style={[styles.youBadge, { backgroundColor: ACCENT }]}>
                  <Text style={[styles.youBadgeText, ff('700'), { fontSize: fs(9), lineHeight: 13 }]}>YOU</Text>
                </View>
              )}
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, ff('600'), { color: statusColor, fontSize: fs(12), lineHeight: 16 }]}>{statusLabel}</Text>
              <Text style={[{ color: colors.textMuted, fontSize: fs(12), lineHeight: 16 }, ff('400')]}>
                · {timeAgo(group.latestSeen)} · {group.sessions.length} {t.devices}
              </Text>
            </View>
          </View>
        </View>

        {/* Contribution stats */}
        <View style={[styles.statsStrip, hairline]}>
          {[
            { n: uStats.loans,     label: t.loansCreated,   color: colors.text },
            { n: uStats.borrowers, label: t.borrowersAdded, color: colors.text },
            { n: uStats.active,    label: t.active,          color: '#10B981'  },
            ...(uStats.overdue > 0 ? [{ n: uStats.overdue, label: t.overdue, color: '#EF4444' }] : []),
          ].map((s, i, arr) => (
            <React.Fragment key={s.label + i}>
              <View style={styles.statCell}>
                <Text style={[styles.statNum, ff('700'), { color: s.color, fontSize: fs(18), lineHeight: 23 }]}>{s.n}</Text>
                <Text style={[styles.statLabel, ff('400'), { color: colors.textMuted, fontSize: fs(10), lineHeight: 13 }]}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && (
                <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Devices */}
        {group.sessions.map((s) => {
          const icon      = s.platform === 'ios' ? 'phone-portrait-outline' : 'logo-android';
          const devStatus = getOnlineStatus(s.lastSeen);
          const isRemov   = removing === s.sessionId;
          return (
            <View key={s.sessionId ?? s.id} style={[styles.deviceRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={[styles.deviceIcon, { backgroundColor: STATUS_COLOR[devStatus] + '18' }]}>
                <Ionicons name={icon} size={15} color={STATUS_COLOR[devStatus]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.deviceName, ff('600'), { color: colors.text, fontSize: fs(13), lineHeight: 18 }]}>{s.deviceModel || 'Unknown'}</Text>
                  {s.uid === myUid && (
                    <View style={[styles.thisBadge, { backgroundColor: ACCENT + '18' }]}>
                      <Text style={[ff('700'), { color: ACCENT, fontSize: fs(9), lineHeight: 13 }]}>THIS</Text>
                    </View>
                  )}
                </View>
                <Text style={[ff('400'), { color: colors.textMuted, fontSize: fs(11), lineHeight: 15 }]}>
                  {s.platform === 'ios' ? 'iOS' : 'Android'} {s.osVersion}  ·  {timeAgo(s.lastSeen)}
                </Text>
                <View style={styles.secRow}>
                  {s.biometricEnabled && (
                    <View style={[styles.secChip, { backgroundColor: ACCENT + '18' }]}>
                      <Ionicons name={s.biometricType === 'faceId' ? 'scan-outline' : 'finger-print'} size={10} color={ACCENT} />
                      <Text style={[ff('600'), { color: ACCENT, fontSize: fs(10), lineHeight: 14 }]}>
                        {s.biometricType === 'faceId' ? t.secFaceId : t.secFingerprint}
                      </Text>
                    </View>
                  )}
                  {s.pinEnabled && (
                    <View style={[styles.secChip, { backgroundColor: '#10B98118' }]}>
                      <Ionicons name="keypad-outline" size={10} color="#10B981" />
                      <Text style={[ff('600'), { color: '#10B981', fontSize: fs(10), lineHeight: 14 }]}>{t.secPin}</Text>
                    </View>
                  )}
                  {!s.biometricEnabled && !s.pinEnabled && s.hasOwnProperty('pinEnabled') && (
                    <View style={[styles.secChip, { backgroundColor: '#EF444418' }]}>
                      <Ionicons name="lock-open-outline" size={10} color="#EF4444" />
                      <Text style={[ff('600'), { color: '#EF4444', fontSize: fs(10), lineHeight: 14 }]}>{t.secNone}</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => handleRemove(s)} disabled={isRemov} style={styles.removeBtn} activeOpacity={0.7}>
                {isRemov
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <Ionicons name="trash-outline" size={15} color="#EF4444" />}
              </TouchableOpacity>
            </View>
          );
        })}
      </GlassCard>
    );
  };

  // ── Render: activity item ─────────────────────────────────────────────────────
  const iconMap = {
    createdLoan:     { name: 'add-circle-outline',  color: '#10B981' },
    editedLoan:      { name: 'pencil-outline',       color: ACCENT },
    createdBorrower: { name: 'person-add-outline',   color: '#F59E0B' },
    editedBorrower:  { name: 'person-outline',       color: '#8B5CF6' },
  };

  const renderActivityItem = (item, last) => {
    const ic = iconMap[item.type] ?? { name: 'ellipse-outline', color: colors.textMuted };
    return (
      <View key={item.key} style={[styles.actRow, !last && hairline]}>
        <View style={[styles.actIcon, { backgroundColor: ic.color + '18' }]}>
          <Ionicons name={ic.name} size={16} color={ic.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ff('400'), { color: colors.text, fontSize: fs(13), lineHeight: 18, marginBottom: 2 }]} numberOfLines={1}>
            {t[item.type]} {t.for} <Text style={ff('600')}>{item.subject}</Text>
          </Text>
          <Text style={[ff('400'), { color: colors.textMuted, fontSize: fs(11), lineHeight: 15 }]}>
            {t.by} {item.byName}  ·  {timeAgo(item.ts)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, ff('800'), { color: colors.text, fontSize: fs(24), lineHeight: 30 }]}>{t.title}</Text>
            <Text style={[ff('400'), { color: colors.textMuted, fontSize: fs(13), lineHeight: 18, marginTop: 1 }]}>{t.subtitle}</Text>
          </View>
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

          {/* ── TEAM STATUS ────────────────────────────────────────────────────── */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, ff('700'), { color: colors.textMuted, fontSize: fs(11) }]}>{t.teamStatus}</Text>
            {onlineCount > 0 && (
              <View style={[styles.onlinePill, { backgroundColor: '#10B98120' }]}>
                <View style={[styles.onlineDot, { backgroundColor: '#10B981' }]} />
                <Text style={[ff('600'), { color: '#10B981', fontSize: fs(10), lineHeight: 14 }]}>{onlineCount} {t.online}</Text>
              </View>
            )}
          </View>
          {userGroups.length === 0 ? (
            <GlassCard style={{ marginBottom: 20 }}>
              <Text style={[ff('400'), { color: colors.textMuted, fontSize: fs(14), lineHeight: 20, padding: 20, textAlign: 'center' }]}>{t.noSessions}</Text>
            </GlassCard>
          ) : (
            <View style={{ marginBottom: 20 }}>
              {userGroups.map(renderUserCard)}
            </View>
          )}

          {/* ── RECENT ACTIVITY ────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, ff('700'), { color: colors.textMuted, fontSize: fs(11) }]}>{t.recentActivity}</Text>
          <GlassCard style={{ marginBottom: 32 }}>
            {activityFeed.length === 0 ? (
              <Text style={[ff('400'), { color: colors.textMuted, fontSize: fs(14), lineHeight: 20, padding: 20, textAlign: 'center' }]}>{t.noActivity}</Text>
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
  root:     { flex: 1 },
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 8 },
  backBtn:  { padding: 4 },
  title:    { letterSpacing: 0 },
  crownWrap:{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content:  { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { letterSpacing: 0, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },

  // Online pill
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  onlineDot:  { width: 7, height: 7, borderRadius: 3.5 },

  // User card
  userTop:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar:      { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:  { letterSpacing: 0, textAlign: 'center' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName:    { letterSpacing: 0, flex: 1 },
  youBadge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  youBadgeText:{ color: '#fff', letterSpacing: 0 },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { letterSpacing: 0 },

  // Stats strip
  statsStrip:  { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14 },
  statCell:    { flex: 1, alignItems: 'center' },
  statNum:     { letterSpacing: 0 },
  statLabel:   { letterSpacing: 0, textAlign: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 4 },

  // Device
  deviceRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10 },
  deviceIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2, flexShrink: 0 },
  deviceName: { letterSpacing: 0 },
  thisBadge:  { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  secRow:     { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  secChip:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  removeBtn:  { padding: 6, flexShrink: 0, marginTop: 2 },

  // Activity
  actRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  actIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
