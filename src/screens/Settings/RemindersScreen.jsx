/**
 * REMINDERS SCREEN — Configure local push notification reminders for loan payments.
 *
 * Settings:
 *   • Enable / Disable payment reminders
 *   • Days before due date (1 | 2 | 3 | 5 | 7)
 *   • Reminder time (HH:MM)
 *
 * All prefs saved to AsyncStorage immediately on change.
 * Calls schedulePaymentReminders() on every save so notifications stay current.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

const ACCENT  = '#8B5CF6';
const DAYS_OPTIONS = [1, 2, 3, 5, 7];

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
    hour:            'Hour (0–23)',
    minute:          'Minute (0–59)',
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
    hour:            'ម៉ោង (0–23)',
    minute:          'នាទី (0–59)',
    save:            'រក្សាទុក',
    cancel:          'បោះបង់',
  },
};

function fmt12h(timeStr) {
  // '09:00' → '9:00 AM', '14:30' → '2:30 PM'
  const [hh, mm] = timeStr.split(':').map(Number);
  const period = hh < 12 ? 'AM' : 'PM';
  const h12    = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

export default function RemindersScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language, ff, fs, fi } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff), [fs, ff]);
  const { loans } = useData();

  const [enabled,    setEnabled]    = useState(false);
  const [days,       setDays]       = useState(DEFAULT_PREFS.days);
  const [time,       setTime]       = useState(DEFAULT_PREFS.time);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hourInput,  setHourInput]  = useState('9');
  const [minInput,   setMinInput]   = useState('00');

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
    setHourInput(String(parseInt(hh, 10)));
    setMinInput(mm);
    setShowTimePicker(true);
  };

  const handleSaveTime = async () => {
    const hh = Math.min(23, Math.max(0, parseInt(hourInput, 10) || 0));
    const mm = Math.min(59, Math.max(0, parseInt(minInput,  10) || 0));
    const newTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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
                          {d}
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

      {/* Time Picker Modal */}
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

            <View style={styles.timeInputRow}>
              {/* Hour */}
              <View style={styles.timeInputCol}>
                <Text style={[styles.timeInputLabel, { color: colors.textMuted }, ff('400')]}>{t.hour}</Text>
                <View style={[styles.timeInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderColor: 'rgba(120,120,128,0.2)' }]}>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text }, fi()]}
                    value={hourInput}
                    onChangeText={v => setHourInput(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="9"
                    placeholderTextColor={colors.textMuted}
                    selectTextOnFocus
                  />
                </View>
              </View>

              <Text style={[styles.timeSep, { color: colors.text }, ff('700')]}>:</Text>

              {/* Minute */}
              <View style={styles.timeInputCol}>
                <Text style={[styles.timeInputLabel, { color: colors.textMuted }, ff('400')]}>{t.minute}</Text>
                <View style={[styles.timeInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderColor: 'rgba(120,120,128,0.2)' }]}>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text }, fi()]}
                    value={minInput}
                    onChangeText={v => setMinInput(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="00"
                    placeholderTextColor={colors.textMuted}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (fs, ff) => StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: fs(22), lineHeight: 34, letterSpacing: 0, paddingLeft: 4 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { fontSize: fs(12), lineHeight: 16, letterSpacing: 0, marginBottom: 8, marginTop: 12 },
  card: { marginBottom: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 10, gap: 12,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14, minHeight: 54, gap: 12,
  },
  rowLabel: { fontSize: fs(15), lineHeight: 20, letterSpacing: 0 },
  rowDesc:  { fontSize: fs(12), lineHeight: 16, letterSpacing: 0, marginTop: 2 },

  // Pills
  pillsRow: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(120,120,128,0.3)',
  },
  pillText: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },

  // Time row
  timeRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeValue:  { fontSize: fs(15), lineHeight: 20, letterSpacing: 0 },

  // Info
  infoText: { flex: 1, fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalSideBtn: { minWidth: 60 },
  modalCancel:  { fontSize: fs(15), lineHeight: 20, letterSpacing: 0 },
  modalTitle:   { fontSize: fs(16), lineHeight: 21, letterSpacing: 0 },
  modalSave:    { fontSize: fs(15), lineHeight: 20, letterSpacing: 0, textAlign: 'right' },

  timeInputRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', padding: 24, gap: 12 },
  timeInputCol: { alignItems: 'center', gap: 6 },
  timeInputLabel: { fontSize: fs(12), lineHeight: 16, letterSpacing: 0 },
  timeInputWrap:  { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  timeInput:      { width: 80, height: 56, textAlign: 'center', fontSize: fs(24), lineHeight: 30, letterSpacing: 0 },
  timeSep:        { fontSize: fs(30), lineHeight: 36, letterSpacing: 0, marginBottom: 6 },
});
