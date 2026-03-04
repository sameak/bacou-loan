/**
 * CHAT ROOM SCREEN
 * Real-time messages (group or DM), text + image sending.
 *
 * Features:
 *  - Full-screen image viewer (tap image)
 *  - Typing indicator (real-time, auto-clears after 4s inactivity)
 *  - Scroll-to-bottom FAB (appears when scrolled up)
 *
 * Keyboard handling: manual Keyboard listeners + Animated (no KeyboardAvoidingView)
 * — KAV is unreliable inside modal-presented navigation screens on iOS.
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
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
import {
  ensureDmChat,
  sendMessage,
  sendImageMessage,
  markRead,
  listenMessages,
  listenChatMeta,
  setTyping,
} from '../../services/chatService';

const ACCENT = '#6366F1';
const TYPING_TIMEOUT = 4000; // ms — clear typing indicator after inactivity

const T = {
  en: {
    placeholder: 'Message...',
    today: 'Today',
    imagePerm: 'Photo library access required. Please enable it in Settings.',
    imageError: 'Failed to send image.',
    typing: name => `${name} is typing…`,
    typingMulti: 'Several people are typing…',
    noMessages: 'No messages yet.\nSay hello! 👋',
  },
  km: {
    placeholder: 'សារ...',
    today: 'ថ្ងៃនេះ',
    imagePerm: 'ត្រូវការការអនុញ្ញាតបណ្ណាល័យរូបភាព។ សូមអនុញ្ញាតក្នុងការកំណត់។',
    imageError: 'បរាជ័យក្នុងការផ្ញើរូបភាព',
    typing: name => `${name} កំពុងវាយ…`,
    typingMulti: 'ជាច្រើននាក់កំពុងវាយ…',
    noMessages: 'មិនទាន់មានសារ។\nនិយាយសួស្ដី! 👋',
  },
};

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

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg, isOwn, isDark, colors, fs, ff, km, onImagePress }) {
  const time = formatTime(msg.createdAt);

  if (msg.type === 'image') {
    return (
      <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
        {!isOwn && (
          <Text style={[styles.senderName, { color: ACCENT }, ff('600'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
            {msg.senderName}
          </Text>
        )}
        <TouchableOpacity onPress={() => onImagePress(msg.imageUrl)} activeOpacity={0.88}>
          <Image source={{ uri: msg.imageUrl }} style={styles.imgThumb} resizeMode="cover" />
          <View style={styles.imgOverlay}>
            <Ionicons name="expand-outline" size={18} color="rgba(255,255,255,0.9)" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.timeText, { color: colors.textMuted }, ff('400'), { fontSize: fs(11), lineHeight: km ? 16 : 15, letterSpacing: 0 }]}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
      {!isOwn && (
        <Text style={[styles.senderName, { color: ACCENT }, ff('600'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
          {msg.senderName}
        </Text>
      )}
      <View style={[
        styles.bubble,
        isOwn
          ? [styles.bubbleOwn, { backgroundColor: ACCENT }]
          : [styles.bubbleOther, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
            }],
      ]}>
        <Text style={[styles.bubbleText, ff('400'), { color: isOwn ? '#fff' : colors.text, fontSize: fs(15), lineHeight: km ? 22 : 20, letterSpacing: 0 }]}>
          {msg.text}
        </Text>
      </View>
      <Text style={[
        styles.timeText, { color: colors.textMuted }, ff('400'),
        { fontSize: fs(11), lineHeight: km ? 16 : 15, letterSpacing: 0 },
        isOwn ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
      ]}>
        {time}
      </Text>
    </View>
  );
}

// ── Typing dots animation ─────────────────────────────────────────────────────

function TypingDots({ isDark, colors }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(480 - i * 160),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingDots}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)',
            opacity: dot,
            transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }]}
        />
      ))}
    </View>
  );
}

// ── Full-screen image viewer ──────────────────────────────────────────────────

function ImageViewer({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.viewerOverlay}>
          <TouchableWithoutFeedback>
            <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
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
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [imageViewerUri, setImageViewerUri] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const flatRef = useRef(null);
  const typingTimer = useRef(null);

  // ── Keyboard offset
  const kbOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = e => {
      Animated.timing(kbOffset, {
        toValue: Math.max(0, e.endCoordinates.height - insets.bottom),
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    };
    const onHide = e => {
      Animated.timing(kbOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    };
    const s1 = Keyboard.addListener(showEvent, onShow);
    const s2 = Keyboard.addListener(hideEvent, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [insets.bottom]);

  // ── Ensure DM chat exists
  useEffect(() => {
    if (!isGroup && otherUid) {
      ensureDmChat(otherUid, otherName ?? 'Unknown').catch(() => {});
    }
  }, [isGroup, otherUid, otherName]);

  // ── Real-time messages
  useEffect(() => {
    if (!chatId) return;
    return listenMessages(chatId, setMessages);
  }, [chatId]);

  // ── Chat metadata (typing users)
  useEffect(() => {
    if (!chatId) return;
    return listenChatMeta(chatId, meta => {
      setTypingUsers(meta.typingUsers ?? {});
    });
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
      .filter(([uid, ts]) => uid !== myUid && ts?.seconds && now - ts.seconds < 6)
      .map(([uid]) => uid);
    if (active.length === 0) return null;
    if (active.length > 1) return t.typingMulti;
    // Find the name from chatMeta memberNames
    return t.typing('…');
  }, [typingUsers, myUid, t]);

  // ── Text change with typing indicator debounce
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
    setSending(true);
    try {
      await sendMessage(chatId, text);
      setText('');
    } catch (e) {
      console.warn('send error:', e);
    } finally {
      setSending(false);
    }
  }

  // ── Image pick
  async function handleImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('', t.imagePerm); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  // ── Date separators for inverted FlatList
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
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }, ff('700'), { fontSize: fs(16), lineHeight: km ? 22 : 21, letterSpacing: 0 }]} numberOfLines={1}>
              {chatName}
            </Text>
            {isGroup && memberCount > 0 && (
              <Text style={[{ color: colors.textMuted }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
                {memberCount} {km ? 'នាក់' : `member${memberCount !== 1 ? 's' : ''}`}
              </Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {/* Message list */}
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
            <View style={[styles.emptyWrap, styles.itemFlip]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400'), { fontSize: fs(14), lineHeight: km ? 20 : 19, letterSpacing: 0 }]}>
                {t.noMessages}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            if (item._type === 'date') {
              const label = formatDateLabel(item.ts);
              return (
                <View style={styles.itemFlip}>
                  <View style={styles.dateSepWrap}>
                    <Text style={[styles.dateSepText, { color: colors.textMuted }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
                      {label ?? t.today}
                    </Text>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.itemFlip}>
                <Bubble
                  msg={item}
                  isOwn={item.senderId === myUid}
                  isDark={isDark}
                  colors={colors}
                  fs={fs}
                  ff={ff}
                  km={km}
                  onImagePress={uri => setImageViewerUri(uri)}
                />
              </View>
            );
          }}
        />

        {/* Scroll-to-bottom FAB */}
        {showScrollDown && (
          <TouchableOpacity
            style={[styles.scrollDownBtn, { backgroundColor: isDark ? 'rgba(40,40,60,0.95)' : 'rgba(255,255,255,0.95)', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
            onPress={() => flatRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={20} color={ACCENT} />
          </TouchableOpacity>
        )}
      </View>

      {/* Typing indicator */}
      {typingLabel && (
        <View style={[styles.typingRow, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
          <TypingDots isDark={isDark} colors={colors} />
          <Text style={[styles.typingText, { color: colors.textMuted }, ff('400'), { fontSize: fs(12), lineHeight: km ? 17 : 16, letterSpacing: 0 }]}>
            {typingLabel}
          </Text>
        </View>
      )}

      {/* Input bar */}
      <Animated.View style={{ marginBottom: kbOffset }}>
        <View style={[styles.inputBar, {
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
          backgroundColor: isDark ? colors.background : '#EBEBEB',
          paddingBottom: insets.bottom + 8,
        }]}>
          <TouchableOpacity style={styles.imgBtn} onPress={handleImage} activeOpacity={0.7} disabled={sending}>
            <Ionicons name="image-outline" size={22} color={sending ? colors.textMuted : ACCENT} />
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

  // Each renderItem needs scaleY:-1 to counteract the inverted FlatList's scaleY:-1
  itemFlip:    { transform: [{ scaleY: -1 }] },

  // Messages
  emptyContent:{ flex: 1 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText:   { textAlign: 'center' },

  msgRow:      { marginBottom: 8, maxWidth: '80%' },
  msgRowOwn:   { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName:  { marginBottom: 3 },
  bubble:      { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleOwn:   { borderBottomRightRadius: 4 },
  bubbleOther: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText:  {},
  timeText:    { marginTop: 3 },

  imgThumb:    { width: 200, height: 160, borderRadius: 12 },
  imgOverlay:  { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 4 },

  dateSepWrap: { alignItems: 'center', marginVertical: 10 },
  dateSepText: {},

  // Scroll-to-bottom
  scrollDownBtn: {
    position: 'absolute', bottom: 12, right: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Typing indicator
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
  viewerClose:   {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
