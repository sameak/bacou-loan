/**
 * CHAT ROOM SCREEN
 * Real-time messages (group or DM), text + image sending.
 *
 * Features:
 *  - Swipe-right on a bubble to quote-reply
 *  - Reply preview strip above input; quoted block inside bubbles
 *  - Online / Away / Offline status in DM header
 *  - Full-screen image viewer (tap image)
 *  - Typing indicator (real-time, auto-clears)
 *  - Scroll-to-bottom FAB
 */

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { auth } from '../../services/firebase';
import { listenUserOnlineStatus } from '../../services/sessionService';
import {
  ensureDmChat,
  sendMessage,
  sendImageMessage,
  sendFileMessage,
  markRead,
  listenMessages,
  listenChatMeta,
  setTyping,
} from '../../services/chatService';

const ACCENT = '#6366F1';
const TYPING_TIMEOUT = 4000;

const STATUS_COLOR = { online: '#10B981', away: '#F59E0B', offline: '#9CA3AF' };
const STATUS_LABEL = { online: 'Online', away: 'Away', offline: 'Offline' };
const STATUS_LABEL_KM = { online: 'អនឡាញ', away: 'ចាកចេញ', offline: 'គ្មានអ៊ីនធឺណិត' };

const T = {
  en: {
    placeholder: 'Message...',
    today: 'Today',
    imagePerm: 'Photo library access required. Please enable it in Settings.',
    imageError: 'Failed to send image.',
    fileError: 'Failed to send file.',
    typing: name => `${name} is typing…`,
    typingMulti: 'Several people are typing…',
    noMessages: 'No messages yet.\nSay hello! 👋',
    replyingTo: name => `Replying to ${name}`,
    open: 'Open',
  },
  km: {
    placeholder: 'សារ...',
    today: 'ថ្ងៃនេះ',
    imagePerm: 'ត្រូវការការអនុញ្ញាតបណ្ណាល័យរូបភាព។ សូមអនុញ្ញាតក្នុងការកំណត់។',
    imageError: 'បរាជ័យក្នុងការផ្ញើរូបភាព',
    fileError: 'បរាជ័យក្នុងការផ្ញើឯកសារ',
    typing: name => `${name} កំពុងវាយ…`,
    typingMulti: 'ជាច្រើននាក់កំពុងវាយ…',
    noMessages: 'មិនទាន់មានសារ។\nនិយាយសួស្ដី! 👋',
    replyingTo: name => `ឆ្លើយតបទៅ ${name}`,
    open: 'បើក',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts?.seconds) return '';
  return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(ts) {
  if (!ts?.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const today = new Date();
  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  ) return null;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType) {
  if (!mimeType) return 'document-outline';
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType.startsWith('video/')) return 'videocam-outline';
  if (mimeType.startsWith('audio/')) return 'musical-notes-outline';
  if (mimeType.includes('pdf')) return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-text-outline';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive-outline';
  return 'document-outline';
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg, isOwn, isDark, colors, fs, ff, km, onImagePress, onReply }) {
  const pan = useRef(new Animated.Value(0)).current;
  const onReplyRef = useRef(onReply);
  useEffect(() => { onReplyRef.current = onReply; }, [onReply]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) pan.setValue(Math.min(g.dx, 72));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50) onReplyRef.current?.(msg);
        Animated.spring(pan, { toValue: 0, useNativeDriver: true, tension: 220, friction: 22 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const iconOpacity = pan.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: 'clamp' });
  const iconScale   = pan.interpolate({ inputRange: [0, 50], outputRange: [0.4, 1], extrapolate: 'clamp' });
  const time = formatTime(msg.createdAt);

  // Quoted reply block (shown inside bubble)
  const quotedBlock = msg.replyTo ? (
    <View style={[
      styles.quoted,
      {
        backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        borderLeftColor: isOwn ? 'rgba(255,255,255,0.6)' : ACCENT,
      },
    ]}>
      <Text style={[styles.quotedSender, { color: isOwn ? 'rgba(255,255,255,0.85)' : ACCENT }, ff('600'), { fontSize: fs(11), lineHeight: km ? 16 : 15, letterSpacing: 0 }]}>
        {msg.replyTo.senderName}
      </Text>
      <Text numberOfLines={1} style={[styles.quotedText, { color: isOwn ? 'rgba(255,255,255,0.65)' : colors.textMuted }, ff('400'), { fontSize: fs(13), lineHeight: km ? 18 : 17, letterSpacing: 0 }]}>
        {msg.replyTo.type === 'image' ? '📷 Photo' : msg.replyTo.type === 'file' ? `📎 ${msg.replyTo.fileName ?? msg.replyTo.text}` : msg.replyTo.text}
      </Text>
    </View>
  ) : null;

  return (
    <View style={styles.bubbleRow} {...panResponder.panHandlers}>
      {/* Reply icon — fades in from left as user swipes */}
      <Animated.View style={[styles.replyHintIcon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
        <Ionicons name="return-up-back" size={18} color={ACCENT} />
      </Animated.View>

      {/* Bubble + sender name + timestamp — slides right */}
      <Animated.View style={[styles.bubbleSlide, { alignItems: isOwn ? 'flex-end' : 'flex-start', transform: [{ translateX: pan }] }]}>
        {!isOwn && (
          <Text style={[styles.senderName, { color: ACCENT }, ff('600'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
            {msg.senderName}
          </Text>
        )}

        {msg.type === 'image' ? (
          <>
            {quotedBlock}
            <TouchableOpacity onPress={() => onImagePress(msg.imageUrl)} activeOpacity={0.88} style={{ position: 'relative' }}>
              <Image source={{ uri: msg.imageUrl }} style={styles.imgThumb} resizeMode="cover" />
              <View style={styles.imgOverlay}>
                <Ionicons name="expand-outline" size={16} color="rgba(255,255,255,0.9)" />
              </View>
            </TouchableOpacity>
          </>
        ) : msg.type === 'file' ? (
          <TouchableOpacity
            onPress={() => msg.fileUrl && Linking.openURL(msg.fileUrl)}
            activeOpacity={0.82}
            style={[
              styles.fileBubble,
              isOwn
                ? { backgroundColor: ACCENT }
                : { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' },
            ]}
          >
            {quotedBlock}
            <View style={styles.fileRow}>
              <View style={[styles.fileIconWrap, { backgroundColor: isOwn ? 'rgba(255,255,255,0.20)' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') }]}>
                <Ionicons name={fileIcon(msg.mimeType)} size={22} color={isOwn ? '#fff' : ACCENT} />
              </View>
              <View style={styles.fileInfo}>
                <Text numberOfLines={2} style={[styles.fileName, ff('600'), { color: isOwn ? '#fff' : colors.text, fontSize: fs(13), lineHeight: km ? 18 : 17, letterSpacing: 0 }]}>
                  {msg.fileName}
                </Text>
                {msg.fileSize > 0 && (
                  <Text style={[ff('400'), { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontSize: fs(11), lineHeight: km ? 16 : 15, letterSpacing: 0 }]}>
                    {fmtSize(msg.fileSize)}
                  </Text>
                )}
              </View>
              <Ionicons name="open-outline" size={18} color={isOwn ? 'rgba(255,255,255,0.8)' : ACCENT} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[
            styles.bubble,
            isOwn
              ? [styles.bubbleOwn, { backgroundColor: ACCENT }]
              : [styles.bubbleOther, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                }],
          ]}>
            {quotedBlock}
            <Text style={[styles.bubbleText, ff('400'), { color: isOwn ? '#fff' : colors.text, fontSize: fs(15), lineHeight: km ? 22 : 20, letterSpacing: 0 }]}>
              {msg.text}
            </Text>
          </View>
        )}

        <Text style={[
          styles.timeText, { color: colors.textMuted }, ff('400'),
          { fontSize: fs(11), lineHeight: km ? 16 : 15, letterSpacing: 0 },
          isOwn ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
        ]}>
          {time}
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots({ isDark }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(480 - i * 160),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={styles.typingDots}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)',
          opacity: dot,
          transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
        }]} />
      ))}
    </View>
  );
}

// ── Image viewer ──────────────────────────────────────────────────────────────

function ImageViewer({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.viewerOverlay}>
          <TouchableWithoutFeedback>
            <Image source={{ uri: uri || '' }} style={styles.viewerImage} resizeMode="contain" />
          </TouchableWithoutFeedback>
          <TouchableOpacity style={styles.viewerClose} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChatRoomScreen({ route, navigation }) {
  const { chatId, chatName, isGroup, memberCount, otherUid, otherName } = route.params ?? {};
  const { colors, isDark } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;
  const km = language === 'km';
  const insets = useSafeAreaInsets();

  const myUid = auth.currentUser?.uid;
  const [messages, setMessages]         = useState([]);
  const [text, setText]                 = useState('');
  const [sending, setSending]           = useState(false);
  const [replyTo, setReplyTo]           = useState(null); // { id, senderName, text, type, imageUrl }
  const [imageViewerUri, setImageViewerUri] = useState(null);
  const [typingUsers, setTypingUsers]   = useState({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(null);
  const flatRef      = useRef(null);
  const typingTimer  = useRef(null);

  // ── Keyboard offset (no KeyboardAvoidingView — unreliable in modal screens)
  const kbOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = e => Animated.timing(kbOffset, {
      toValue: Math.max(0, e.endCoordinates.height - insets.bottom),
      duration: Platform.OS === 'ios' ? e.duration : 200,
      useNativeDriver: false,
    }).start();
    const onHide = e => Animated.timing(kbOffset, {
      toValue: 0,
      duration: Platform.OS === 'ios' ? e.duration : 200,
      useNativeDriver: false,
    }).start();
    const s1 = Keyboard.addListener(showEvent, onShow);
    const s2 = Keyboard.addListener(hideEvent, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [insets.bottom]);

  // ── DM setup + online status
  useEffect(() => {
    if (isGroup || !otherUid) return;
    ensureDmChat(otherUid, otherName ?? 'Unknown').catch(() => {});
    return listenUserOnlineStatus(otherUid, setOnlineStatus);
  }, [isGroup, otherUid, otherName]);

  // ── Messages
  useEffect(() => {
    if (!chatId) return;
    return listenMessages(chatId, setMessages);
  }, [chatId]);

  // ── Typing users
  useEffect(() => {
    if (!chatId) return;
    return listenChatMeta(chatId, meta => setTypingUsers(meta.typingUsers ?? {}));
  }, [chatId]);

  // ── Mark read on focus; clear typing on blur
  useFocusEffect(
    useCallback(() => {
      if (chatId) markRead(chatId).catch(() => {});
      return () => {
        clearTimeout(typingTimer.current);
        setTyping(chatId, false);
      };
    }, [chatId]),
  );

  // ── Typing label
  const typingLabel = useMemo(() => {
    if (!typingUsers || !myUid) return null;
    const now = Date.now() / 1000;
    const active = Object.entries(typingUsers)
      .filter(([uid, ts]) => uid !== myUid && ts?.seconds && now - ts.seconds < 6);
    if (active.length === 0) return null;
    return active.length > 1 ? t.typingMulti : t.typing('…');
  }, [typingUsers, myUid, t]);

  // ── Text change with typing debounce
  function handleTextChange(val) {
    setText(val);
    if (val.trim()) {
      setTyping(chatId, true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(chatId, false), TYPING_TIMEOUT);
    } else {
      clearTimeout(typingTimer.current);
      setTyping(chatId, false);
    }
  }

  // ── Send
  async function handleSend() {
    if (!text.trim() || sending) return;
    clearTimeout(typingTimer.current);
    setTyping(chatId, false);
    const pendingReply = replyTo;
    setReplyTo(null);
    setSending(true);
    try {
      await sendMessage(chatId, text, pendingReply);
      setText('');
    } catch (e) {
      console.warn('send error:', e);
      setReplyTo(pendingReply);
    } finally {
      setSending(false);
    }
  }

  // ── Image pick + send
  async function handleImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('', t.imagePerm); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setSending(true);
    try {
      await sendImageMessage(chatId, result.assets[0].uri);
    } catch (e) {
      Alert.alert('', t.imageError);
    } finally {
      setSending(false);
    }
  }

  // ── File pick + send
  async function handleFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSending(true);
      await sendFileMessage(chatId, asset.uri, asset.name, asset.size, asset.mimeType);
    } catch (e) {
      Alert.alert('', t.fileError);
    } finally {
      setSending(false);
    }
  }

  // ── Date separators
  const messagesWithDates = useMemo(() => {
    const items = [];
    for (let i = 0; i < messages.length; i++) {
      items.push({ ...messages[i], _type: 'msg' });
      const curr = messages[i];
      const next = messages[i + 1];
      if (!next) {
        items.push({ _type: 'date', _key: `date_${i}`, ts: curr.createdAt });
      } else {
        const cDay = curr.createdAt?.seconds ? new Date(curr.createdAt.seconds * 1000).toDateString() : '';
        const nDay = next.createdAt?.seconds ? new Date(next.createdAt.seconds * 1000).toDateString() : '';
        if (cDay !== nDay) items.push({ _type: 'date', _key: `date_${i}`, ts: curr.createdAt });
      }
    }
    return items;
  }, [messages]);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }, ff('700'), { fontSize: fs(16), lineHeight: km ? 22 : 21, letterSpacing: 0 }]} numberOfLines={1}>
              {chatName}
            </Text>
            {isGroup && memberCount > 0 ? (
              <Text style={[{ color: colors.textMuted }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
                {memberCount} {km ? 'នាក់' : `member${memberCount !== 1 ? 's' : ''}`}
              </Text>
            ) : !isGroup && onlineStatus ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[onlineStatus] }]} />
                <Text style={[{ color: STATUS_COLOR[onlineStatus] }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
                  {km ? STATUS_LABEL_KM[onlineStatus] : STATUS_LABEL[onlineStatus]}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {/* ── Message list ── */}
      <View style={styles.flex}>
        <FlatList
          ref={flatRef}
          data={messagesWithDates}
          keyExtractor={item => item.id ?? item._key}
          inverted
          style={styles.flex}
          contentContainerStyle={[
            { paddingHorizontal: 16, paddingTop: 12 },
            messages.length === 0 && styles.emptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          scrollEventThrottle={100}
          onScroll={e => setShowScrollDown(e.nativeEvent.contentOffset.y > 150)}
          ListEmptyComponent={() => (
            <View style={[styles.emptyWrap, styles.emptyFlip]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400'), { fontSize: fs(14), lineHeight: km ? 20 : 19, letterSpacing: 0, textAlign: 'center' }]}>
                {t.noMessages}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            if (item._type === 'date') {
              const label = formatDateLabel(item.ts);
              return (
                <View style={styles.dateSepWrap}>
                  <Text style={[styles.dateSepText, { color: colors.textMuted }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
                    {label ?? t.today}
                  </Text>
                </View>
              );
            }
            return (
              <Bubble
                msg={item}
                isOwn={item.senderId === myUid}
                isDark={isDark}
                colors={colors}
                fs={fs}
                ff={ff}
                km={km}
                onImagePress={uri => setImageViewerUri(uri)}
                onReply={msg => setReplyTo({ id: msg.id, senderName: msg.senderName, text: msg.text, type: msg.type, imageUrl: msg.imageUrl })}
              />
            );
          }}
        />

        {/* Scroll-to-bottom FAB */}
        {showScrollDown && (
          <TouchableOpacity
            style={[styles.scrollDownBtn, {
              backgroundColor: isDark ? 'rgba(30,30,50,0.95)' : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            }]}
            onPress={() => flatRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={20} color={ACCENT} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom area (reply preview + typing + input), lifts with keyboard ── */}
      <Animated.View style={{ marginBottom: kbOffset }}>
        {/* Reply preview strip */}
        {replyTo && (
          <View style={[styles.replyPreview, {
            backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)',
            borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          }]}>
            <View style={[styles.replyPreviewBar, { backgroundColor: ACCENT }]} />
            <View style={styles.replyPreviewContent}>
              <Text style={[styles.replyPreviewName, { color: ACCENT }, ff('600'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
                {t.replyingTo(replyTo.senderName)}
              </Text>
              <Text numberOfLines={1} style={[{ color: colors.textMuted }, ff('400'), { fontSize: fs(13), lineHeight: km ? 18 : 17, letterSpacing: 0 }]}>
                {replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'file' ? `📎 ${replyTo.fileName ?? replyTo.text}` : replyTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyPreviewClose} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Typing indicator */}
        {typingLabel && (
          <View style={[styles.typingRow, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
            <TypingDots isDark={isDark} />
            <Text style={[styles.typingText, { color: colors.textMuted }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
              {typingLabel}
            </Text>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, {
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
          backgroundColor: isDark ? colors.background : '#EBEBEB',
          paddingBottom: insets.bottom + 8,
        }]}>
          <TouchableOpacity style={styles.imgBtn} onPress={handleImage} activeOpacity={0.7} disabled={sending}>
            <Ionicons name="image-outline" size={22} color={sending ? colors.textMuted : ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.imgBtn} onPress={handleFile} activeOpacity={0.7} disabled={sending}>
            <Ionicons name="attach-outline" size={22} color={sending ? colors.textMuted : ACCENT} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            }, ff('400')]}
            value={text}
            onChangeText={handleTextChange}
            placeholder={t.placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="default"
            onSubmitEditing={Platform.OS === 'ios' ? undefined : handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, {
              backgroundColor: text.trim() && !sending ? ACCENT : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
            }]}
            onPress={handleSend}
            activeOpacity={0.7}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color={text.trim() ? '#fff' : colors.textMuted} />
            }
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Full-screen image viewer */}
      <ImageViewer uri={imageViewerUri} onClose={() => setImageViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  flex:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: {},
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },

  emptyContent:{ flex: 1 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyFlip:   { transform: [{ scaleY: -1 }] },
  emptyText:   {},

  // Bubble row (outer, handles swipe gesture)
  bubbleRow:   { marginBottom: 8 },
  bubbleSlide: { flex: 1 },

  // Reply hint icon (left side, fades in on swipe)
  replyHintIcon: { position: 'absolute', left: 0, top: '50%', marginTop: -9, zIndex: 1 },

  senderName:  { marginBottom: 3, paddingLeft: 2 },
  bubble:      { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, maxWidth: '80%' },
  bubbleOwn:   { borderBottomRightRadius: 4 },
  bubbleOther: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText:  {},
  timeText:    { marginTop: 3, paddingHorizontal: 2 },

  // Quoted block inside bubble
  quoted:      { flexDirection: 'row', borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6, gap: 0, maxWidth: 260 },
  quotedSender:{},
  quotedText:  {},

  imgThumb:    { width: 200, height: 160, borderRadius: 12 },
  imgOverlay:  { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6, padding: 4 },

  fileBubble:  { borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 12, paddingVertical: 10, maxWidth: '80%' },
  fileRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIconWrap:{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileInfo:    { flex: 1, gap: 2 },
  fileName:    {},

  dateSepWrap: { alignItems: 'center', marginVertical: 10 },
  dateSepText: {},

  // Scroll-to-bottom
  scrollDownBtn: {
    position: 'absolute', bottom: 12, right: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Reply preview strip
  replyPreview:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  replyPreviewBar:    { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  replyPreviewContent:{ flex: 1, gap: 1 },
  replyPreviewName:   {},
  replyPreviewClose:  { padding: 4 },

  // Typing
  typingRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 4, gap: 8 },
  typingText:  {},
  typingDots:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:         { width: 5, height: 5, borderRadius: 3 },

  // Input bar
  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  imgBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input:       { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, maxHeight: 120, fontSize: 15, lineHeight: 20 },
  sendBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Image viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerImage:   { width: '100%', height: '100%' },
  viewerClose:   { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
