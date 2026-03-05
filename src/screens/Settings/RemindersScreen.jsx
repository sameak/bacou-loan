/**
 * REMINDERS SCREEN — Configure local push notification reminders for loan payments.
 *
 * Settings:
 *   • Enable / Disable payment reminders
 *   • Days before due date (1 | 2 | 3 | 5 | 7)
 *   • Reminder time (HH:MM) — scroll wheel picker
 *
 * All prefs saved to AsyncStorage immediately on change.
 * Calls schedulePaymentReminders() on every save so notifications stay current.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
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
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';
import {
  REMINDER_KEY,
  DEFAULT_PREFS,
  requestNotificationPermission,
  schedulePaymentReminders,
  cancelAllReminders,
} from '../../services/notificationService';

const ACCENT       = '#8B5CF6';
const DAYS_OPTIONS = [0, 1, 2, 3, 5, 7];
const DAYS_LABEL   = (d, language) => d === 0
  ? (language === 'km' ? 'ថ្ងៃបង់' : 'Same day')
  : String(d);

const ITEM_H  = 52;             // height of each wheel row
const VISIBLE = 5;              // rows visible at once
const WHEEL_H = ITEM_H * VISIBLE;

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const T = {
  en: {
    title:           'Reminders',
    enableSection:   'PAYMENT REMINDERS',
    enable:          'Payment Reminders',
    enableDesc:      'Notify before payment due dates',
    settingsSection: 'REMINDER SETTINGS',
    daysBefore:      'Remind me before',
    reminderTime:    'Reminder Time',
    infoSection:     'INFO',
    statusText:      'Notifications will be scheduled each time the app opens.',
    permissionDenied:'Notifications blocked. Enable in device Settings.',
    day:             'day',
    days:            'days',
    timePickerTitle: 'Set Reminder Time',
    save:            'Save',
    cancel:          'Cancel',
  },
  km: {
    title:           'រំលឹក',
    enableSection:   'រំលឹកការទូទាត់',
    enable:          'រំលឹកការទូទាត់',
    enableDesc:      'ជូនដំណឹងមុនកាលបរិច្ឆេទបង់ប្រាក់',
    settingsSection: 'ការកំណត់',
    daysBefore:      'រំលឹកមុន',
    reminderTime:    'ម៉ោងរំលឹក',
    infoSection:     'ព័ត៌មាន',
    statusText:      'ការជូនដំណឹងនឹងត្រូវគ្រោងរៀងរាល់ពេលបើកកម្មវិធី។',
    permissionDenied:'ការជូនដំណឹងត្រូវបានបិទ។ បើកនៅក្នុងការកំណត់ឧបករណ៍។',
    day:             'ថ្ងៃ',
    days:            'ថ្ងៃ',
    timePickerTitle: 'កំណត់ម៉ោងរំលឹក',
    save:            'រក្សាទុក',
    cancel:          'បោះបង់',
  },
};

function fmt12h(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const period = hh < 12 ? 'AM' : 'PM';
  const h12    = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

// ── Drum-roll scroll wheel ────────────────────────────────────────────────────
const OPACITIES  = [1, 0.5, 0.22, 0.1];
const FONT_SIZES = (fs) => [fs(26), fs(21), fs(17), fs(14)];
const LINE_HTS   = [34, 28, 22, 20];

function WheelPicker({ data, selectedIndex, onIndexChange, colors, isDark, ff, fs }) {
  const scrollRef    = useRef(null);
  const hapticRef    = useRef(-1);
  const momentumRef  = useRef(false);
  const [localIdx, setLocalIdx] = useState(selectedIndex);

  // Jump to current value when modal opens (component remounts each open via key=)
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const clamp = (y) =>
    Math.max(0, Math.min(data.length - 1, Math.round(y / ITEM_H)));

  // Live tracking during drag — haptic + visual update
  const handleScroll = (e) => {
    const idx = clamp(e.nativeEvent.contentOffset.y);
    if (idx !== hapticRef.current) {
      hapticRef.current = idx;
      setLocalIdx(idx);
      Haptics.selectionAsync();
    }
  };

  // Commit final value — NO programmatic scrollTo here (avoids re-trigger loop)
  const commit = (y) => {
    const idx = clamp(y);
    setLocalIdx(idx);
    onIndexChange(idx);
  };

  const fontSizes = useMemo(() => FONT_SIZES(fs), [fs]);
  const fadeBg    = isDark ? 'rgba(28,28,40,0.88)' : 'rgba(255,255,255,0.88)';

  return (
    <View style={{ width: 90, height: WHEEL_H, overflow: 'hidden' }}>
      {/* Selection highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_H * 2, left: 4, right: 4, height: ITEM_H,
          backgroundColor: isDark ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.12)',
          borderRadius: 12,
        }}
      />
      {/* Top fade */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2, backgroundColor: fadeBg, zIndex: 1 }} />
      {/* Bottom fade */}
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2, backgroundColor: fadeBg, zIndex: 1 }} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={() => { momentumRef.current = false; }}
        onMomentumScrollBegin={() => { momentumRef.current = true; }}
        onScrollEndDrag={(e) => {
          // Only commit here if no momentum scroll will follow (slow drag)
          if (!momentumRef.current) commit(e.nativeEvent.contentOffset.y);
        }}
        onMomentumScrollEnd={(e) => {
          momentumRef.current = false;
          commit(e.nativeEvent.contentOffset.y);
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {data.map((item, index) => {
          const dist = Math.min(Math.abs(index - localIdx), 3);
          return (
            <View key={index} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{
                fontSize: fontSizes[dist],
                lineHeight: LINE_HTS[dist],
                letterSpacing: 0,
                color: colors.text,
                opacity: OPACITIES[dist],
                ...ff(dist === 0 ? '600' : '400'),
              }}>
                {String(item).padStart(2, '0')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RemindersScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff, language), [fs, ff, language]);
  const { loans } = useData();

  const [enabled,        setEnabled]        = useState(false);
  const [days,           setDays]           = useState(DEFAULT_PREFS.days);
  const [time,           setTime]           = useState(DEFAULT_PREFS.time);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hourVal,        setHourVal]        = useState(9);
  const [minVal,         setMinVal]         = useState(0);

  // ── Load prefs on mount ───────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY).then(raw => {
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.enabled !== undefined) setEnabled(p.enabled);
      if (p.days    !== undefined) setDays(p.days);
      if (p.time    !== undefined) setTime(p.time);
    });
  }, []);

  // ── Persist + reschedule whenever any pref changes ───────────────────────
  async function savePrefs(newPrefs) {
    const merged = { enabled, days, time, ...newPrefs };
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(merged));
    if (merged.enabled) {
      await schedulePaymentReminders(loans);
    } else {
      await cancelAllReminders();
    }
  }

  // ── Toggle enable ─────────────────────────────────────────────────────────
  const handleToggle = async (val) => {
    if (val) {
      const status = await requestNotificationPermission();
      if (status !== 'granted') {
        Toast.show({ text: t.permissionDenied, type: 'error' });
        return;
      }
    }
    setEnabled(val);
    await savePrefs({ enabled: val });
  };

  // ── Days pill ─────────────────────────────────────────────────────────────
  const handleDaySelect = async (d) => {
    setDays(d);
    await savePrefs({ days: d });
  };

  // ── Time picker ───────────────────────────────────────────────────────────
  const openTimePicker = () => {
    const [hh, mm] = time.split(':');
    setHourVal(parseInt(hh, 10));
    setMinVal(parseInt(mm, 10));
    setShowTimePicker(true);
  };

  const handleSaveTime = async () => {
    const newTime = `${String(hourVal).padStart(2, '0')}:${String(minVal).padStart(2, '0')}`;
    setTime(newTime);
    setShowTimePicker(false);
    await savePrefs({ time: newTime });
  };

  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, ff('700'), { color: colors.text }]}>{t.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Enable toggle ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('700')]}>{t.enableSection}</Text>
        <GlassCard style={styles.card}>
          <View style={[styles.row, { minHeight: 56 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }, ff('400')]}>{t.enable}</Text>
              <Text style={[styles.rowDesc,  { color: colors.textMuted }, ff('400')]}>{t.enableDesc}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: '#D1D5DB', true: ACCENT + '80' }}
              thumbColor={enabled ? ACCENT : '#fff'}
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </GlassCard>

        {/* ── Reminder settings (only visible when enabled) ── */}
        {enabled && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('700')]}>{t.settingsSection}</Text>
            <GlassCard style={styles.card}>

              {/* Days before */}
              <View style={[styles.settingRow, divider]}>
                <Text style={[styles.rowLabel, { color: colors.text }, ff('400')]}>{t.daysBefore}</Text>
                <View style={styles.pillsRow}>
                  {DAYS_OPTIONS.map(d => {
                    const active = d === days;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.pill, active && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                        onPress={() => handleDaySelect(d)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, { color: active ? '#fff' : colors.text }, ff(active ? '600' : '400')]}>
                          {DAYS_LABEL(d, language)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Reminder time */}
              <TouchableOpacity style={styles.settingRow} onPress={openTimePicker} activeOpacity={0.7}>
                <Text style={[styles.rowLabel, { color: colors.text }, ff('400')]}>{t.reminderTime}</Text>
                <View style={styles.timeRight}>
                  <Text style={[styles.timeValue, { color: ACCENT }, ff('600')]}>{fmt12h(time)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

            </GlassCard>
          </>
        )}

        {/* ── Info ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('700')]}>{t.infoSection}</Text>
        <GlassCard style={styles.card}>
          <View style={[styles.row, { paddingVertical: 14 }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} style={{ marginRight: 10, marginTop: 1 }} />
            <Text style={[styles.infoText, { color: colors.textMuted }, ff('400')]}>{t.statusText}</Text>
          </View>
        </GlassCard>

      </ScrollView>

      {/* ── Time Picker Modal (drum-roll wheels) ── */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? colors.surface ?? '#1C1C28' : '#fff' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            <View style={[styles.modalHeader, { borderBottomColor: colors.border ?? 'rgba(0,0,0,0.1)' }]}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.modalSideBtn}>
                <Text style={[styles.modalCancel, { color: colors.textMuted }, ff('400')]}>{t.cancel}</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }, ff('700')]}>{t.timePickerTitle}</Text>
              <TouchableOpacity onPress={handleSaveTime} style={styles.modalSideBtn}>
                <Text style={[styles.modalSave, { color: ACCENT }, ff('700')]}>{t.save}</Text>
              </TouchableOpacity>
            </View>

            {/* Wheels */}
            <View style={styles.wheelRow}>
              <WheelPicker
                key={`h-${showTimePicker}`}
                data={HOURS}
                selectedIndex={hourVal}
                onIndexChange={setHourVal}
                colors={colors}
                isDark={isDark}
                ff={ff}
                fs={fs}
              />
              <Text style={[styles.wheelSep, { color: colors.text }, ff('700')]}>:</Text>
              <WheelPicker
                key={`m-${showTimePicker}`}
                data={MINUTES}
                selectedIndex={minVal}
                onIndexChange={setMinVal}
                colors={colors}
                isDark={isDark}
                ff={ff}
                fs={fs}
              />
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (fs, ff, language) => {
  const km = true;
  return StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: fs(22), lineHeight: km ? 44 : 34, letterSpacing: 0, paddingLeft: 4 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { fontSize: fs(12), lineHeight: km ? 21 : 16, letterSpacing: 0, marginBottom: 8, marginTop: 12 },
  card: { marginBottom: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 10, gap: 12,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14, minHeight: 54, gap: 12,
  },
  rowLabel: { fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0 },
  rowDesc:  { fontSize: fs(12), lineHeight: km ? 21 : 16, letterSpacing: 0, marginTop: 2 },

  pillsRow: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(120,120,128,0.3)',
  },
  pillText: { fontSize: fs(13), lineHeight: km ? 23 : 18, letterSpacing: 0 },

  timeRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeValue: { fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0 },

  infoText: { flex: 1, fontSize: fs(13), lineHeight: km ? 23 : 18, letterSpacing: 0 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalSideBtn: { minWidth: 60 },
  modalCancel:  { fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0 },
  modalTitle:   { fontSize: fs(16), lineHeight: km ? 27 : 21, letterSpacing: 0 },
  modalSave:    { fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0, textAlign: 'right' },

  // Wheel picker
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4 },
  wheelSep: { fontSize: fs(28), lineHeight: km ? 47 : 36, letterSpacing: 0, marginTop: -4 },
});
};
