/**
 * CHAT LIST SCREEN
 * Shows Group Chat + Direct Messages with other team members.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import { auth } from '../../services/firebase';
import { listenAllSessions } from '../../services/sessionService';
import {
  ensureGroupChat,
  listenChats,
  dmChatId,
} from '../../services/chatService';

const ACCENT = '#6366F1';

const T = {
  en: {
    title: 'Chat',
    groupChat: 'Group Chat',
    members: n => `${n} member${n !== 1 ? 's' : ''}`,
    directMessages: 'DIRECT MESSAGES',
    noMessages: 'No messages yet',
    online: 'Online',
    tapToChat: 'Tap to start chatting',
  },
  km: {
    title: 'ជជែក',
    groupChat: 'ជជែកក្រុម',
    members: n => `${n} នាក់`,
    directMessages: 'សារផ្ទាល់ខ្លួន',
    noMessages: 'មិនទាន់មានសារ',
    online: 'អនឡាញ',
    tapToChat: 'ចុចដើម្បីចាប់ផ្ដើម',
  },
};

function getOnlineStatus(lastSeen) {
  if (!lastSeen?.seconds) return 'offline';
  const diff = Date.now() / 1000 - lastSeen.seconds;
  if (diff < 5 * 60) return 'online';
  if (diff < 60 * 60) return 'away';
  return 'offline';
}

function formatRelativeTime(ts) {
  if (!ts?.seconds) return '';
  const diff = Math.floor(Date.now() / 1000 - ts.seconds);
  if (diff < 60)         return 'now';
  if (diff < 3600)       return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 6)  return `${Math.floor(diff / 86400)}d`;
  const d = new Date(ts.seconds * 1000);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const STATUS_COLOR = { online: '#10B981', away: '#F59E0B', offline: '#9CA3AF' };

function Initials({ name, size = 38, isDark }) {
  const { ff } = useLanguage();
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: ACCENT, fontSize: size * 0.38, ...ff('700'), letterSpacing: 0 }}>
        {initials}
      </Text>
    </View>
  );
}

export default function ChatListScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;
  const isKhmer = true;
  const styles = useMemo(() => makeStyles(ff, fs, isKhmer), [ff, fs, isKhmer]);

  const myUid = auth.currentUser?.uid;
  const [chats, setChats] = useState([]);
  const [otherUsers, setOtherUsers] = useState([]);

  // Ensure group chat exists
  useEffect(() => { ensureGroupChat(); }, []);

  // Listen to all chats user is in
  useEffect(() => {
    return listenChats(setChats);
  }, []);

  // Listen to all sessions to build user list
  useEffect(() => {
    return listenAllSessions(sessions => {
      const seen = new Set();
      const users = [];
      for (const s of sessions) {
        if (!s.uid || s.uid === myUid || seen.has(s.uid)) continue;
        seen.add(s.uid);
        users.push({ uid: s.uid, name: s.displayName || 'Unknown', lastSeen: s.lastSeen });
      }
      setOtherUsers(users);
    });
  }, [myUid]);

  const groupChat = chats.find(c => c.id === 'group_main');
  const groupUnread = groupChat?.unreadCounts?.[myUid] ?? 0;
  const memberCount = groupChat?.members?.length ?? 0;

  function getUnreadForDm(otherUid) {
    const cid = dmChatId(myUid, otherUid);
    const chat = chats.find(c => c.id === cid);
    return chat?.unreadCounts?.[myUid] ?? 0;
  }

  function getLastMessageForDm(otherUid) {
    const cid = dmChatId(myUid, otherUid);
    const chat = chats.find(c => c.id === cid);
    return chat?.lastMessage ?? '';
  }

  function getLastTimeForDm(otherUid) {
    const cid = dmChatId(myUid, otherUid);
    const chat = chats.find(c => c.id === cid);
    return chat?.lastMessageTime ?? null;
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }, ff('700')]}>{t.title}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <FlatList
        data={otherUsers}
        keyExtractor={u => u.uid}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={() => (
          <>
            {/* Group Chat */}
            <GlassCard style={styles.groupCard}>
              <TouchableOpacity
                style={styles.groupRow}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('ChatRoom', {
                  chatId: 'group_main',
                  chatName: t.groupChat,
                  isGroup: true,
                  memberCount,
                })}
              >
                <View style={[styles.groupIconWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)' }]}>
                  <Ionicons name="chatbubbles" size={22} color={ACCENT} />
                </View>
                <View style={styles.groupInfo}>
                  <View style={styles.rowTopLine}>
                    <Text style={[styles.groupName, { color: colors.text }, ff('600')]}>{t.groupChat}</Text>
                    {groupChat?.lastMessageTime ? (
                      <Text style={[styles.timeLabel, { color: colors.textMuted }, ff('400')]}>{formatRelativeTime(groupChat.lastMessageTime)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.groupMeta, { color: colors.textMuted }, ff('400')]}>
                    {memberCount > 0 ? t.members(memberCount) : t.tapToChat}
                  </Text>
                  {groupChat?.lastMessage ? (
                    <Text style={[styles.lastMsg, { color: colors.textMuted }, ff('400')]} numberOfLines={1}>
                      {groupChat.lastMessage}
                    </Text>
                  ) : null}
                </View>
                {groupUnread > 0 && (
                  <View style={styles.badge}>
                    <Text style={[styles.badgeText, ff('700')]}>{groupUnread > 99 ? '99+' : groupUnread}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </GlassCard>

            {/* DM section header */}
            <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('700')]}>{t.directMessages}</Text>
          </>
        )}
        renderItem={({ item: user }) => {
          const status  = getOnlineStatus(user.lastSeen);
          const unread  = getUnreadForDm(user.uid);
          const lastMsg = getLastMessageForDm(user.uid);
          const lastTs  = getLastTimeForDm(user.uid);
          return (
            <GlassCard style={styles.dmCard}>
              <TouchableOpacity
                style={styles.dmRow}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('ChatRoom', {
                  chatId: dmChatId(myUid, user.uid),
                  chatName: user.name,
                  isGroup: false,
                  otherUid: user.uid,
                  otherName: user.name,
                })}
              >
                <View style={{ position: 'relative' }}>
                  <Initials name={user.name} isDark={isDark} />
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[status] }]} />
                </View>
                <View style={styles.dmInfo}>
                  <View style={styles.rowTopLine}>
                    <Text style={[styles.dmName, { color: colors.text }, ff('600')]}>{user.name}</Text>
                    {lastTs ? (
                      <Text style={[styles.timeLabel, { color: colors.textMuted }, ff('400')]}>{formatRelativeTime(lastTs)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.dmMeta, { color: unread > 0 ? colors.text : colors.textMuted }, unread > 0 ? ff('600') : ff('400')]} numberOfLines={1}>
                    {lastMsg || t.noMessages}
                  </Text>
                </View>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={[styles.badgeText, ff('700')]}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </GlassCard>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400')]}>{t.noMessages}</Text>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (ff, fs, km) => StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:       { flex: 1, textAlign: 'center', fontSize: fs(17), letterSpacing: 0 },
  content:     { paddingHorizontal: 16, paddingBottom: 40 },

  sectionTitle:{ fontSize: fs(11), letterSpacing: 0, marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },

  groupCard:   { marginBottom: 0 },
  groupRow:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  groupIconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTopLine:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeLabel:   { fontSize: fs(12), letterSpacing: 0 },
  groupInfo:   { flex: 1, gap: 2 },
  groupName:   { fontSize: fs(15), letterSpacing: 0 },
  groupMeta:   { fontSize: fs(13), letterSpacing: 0 },
  lastMsg:     { fontSize: fs(13), letterSpacing: 0 },

  dmCard:      { marginTop: 8 },
  dmRow:       { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dmInfo:      { flex: 1, gap: 2 },
  dmName:      { fontSize: fs(15), letterSpacing: 0 },
  dmMeta:      { fontSize: fs(13), letterSpacing: 0 },

  statusDot:   { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: 'transparent' },

  badge:       { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:   { color: '#fff', fontSize: 11, letterSpacing: 0 },

  emptyWrap:   { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyText:   { fontSize: fs(14), letterSpacing: 0 },
});
