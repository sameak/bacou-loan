/**
 * CAPITAL SCREEN — Set shared business capital + full change history
 *
 * Shows current USD + KHR capital, inline edit form, and a chronological
 * history of every update with the editor's name and timestamp.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { listenCapital, listenCapitalHistory, saveCapital } from '../../services/capitalService';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';

const ACCENT = '#00C2B2';
const GREEN  = '#10B981';

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title:       'My Capital',
    currentUSD:  'USD Capital',
    currentKHR:  'KHR Capital',
    notSet:      'Not set',
    edit:        'Edit',
    save:        'Save',
    cancel:      'Cancel',
    capitalUSD:  'Capital (USD $)',
    capitalKHR:  'Capital (KHR ៛)',
    capitalHint: 'Enter 0 to hide a currency',
    capitalSaved:'Capital saved',
    history:     'CHANGE HISTORY',
    noHistory:   'No changes recorded yet.',
    by:          'by',
    updatedBy:   name => `Updated by ${name}`,
  },
  km: {
    title:       'ដើមទុនខ្ញុំ',
    currentUSD:  'ដើមទុន USD',
    currentKHR:  'ដើមទុន KHR',
    notSet:      'មិនទាន់បញ្ចូល',
    edit:        'កែ',
    save:        'រក្សាទុក',
    cancel:      'បោះបង់',
    capitalUSD:  'ដើមទុន (USD $)',
    capitalKHR:  'ដើមទុន (KHR ៛)',
    capitalHint: 'បញ្ចូល 0 ដើម្បីលាក់រូបិយប័ណ្ណ',
    capitalSaved:'បានរក្សាទុកដើមទុន',
    history:     'ប្រវត្តិការផ្លាស់ប្ដូរ',
    noHistory:   'មិនទាន់មានការផ្លាស់ប្ដូរ',
    by:          'ដោយ',
    updatedBy:   name => `កែដោយ ${name}`,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtKHR(n) { return '៛' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date}  ${time}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CapitalScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { language, ff, fs, fi } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff, language), [fs, ff, language]);

  const [capital, setCapital]   = useState({ capitalUSD: 0, capitalKHR: 0 });
  const [history, setHistory]   = useState([]);
  const [editing, setEditing]   = useState(false);
  const [usdInput, setUsdInput] = useState('');
  const [khrInput, setKhrInput] = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => listenCapital(setCapital), []);
  useEffect(() => listenCapitalHistory(setHistory), []);

  const openEdit = () => {
    setUsdInput(capital.capitalUSD > 0 ? String(capital.capitalUSD) : '');
    setKhrInput(capital.capitalKHR > 0 ? String(capital.capitalKHR) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const usd = parseFloat(usdInput.replace(/,/g, '')) || 0;
      const khr = parseFloat(khrInput.replace(/,/g, '')) || 0;
      await saveCapital({ capitalUSD: usd, capitalKHR: khr });
      Toast.show({ text: t.capitalSaved, type: 'success' });
      setEditing(false);
    } catch (err) {
      Toast.show({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, ff('700'), { color: colors.text }]}>{t.title}</Text>
        {!editing ? (
          <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
            <Text style={[styles.editBtnText, ff('600'), { color: ACCENT }]}>{t.edit}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Current values card ─────────────────────────────── */}
          <GlassCard style={styles.card}>
            <View style={styles.currentRow}>
              <View style={styles.currentCol}>
                <Text style={[styles.currLabel, ff('600'), { color: colors.subtext ?? '#8E8E93' }]}>{t.currentUSD}</Text>
                <Text style={[capital.capitalUSD > 0 ? styles.currValue : styles.currNotSet, ff('400'), { color: capital.capitalUSD > 0 ? colors.text : (colors.subtext ?? '#8E8E93') }]}>
                  {capital.capitalUSD > 0 ? fmtUSD(capital.capitalUSD) : t.notSet}
                </Text>
              </View>
              <View style={[styles.currentDivider, { backgroundColor: 'rgba(120,120,128,0.2)' }]} />
              <View style={[styles.currentCol, { alignItems: 'flex-end' }]}>
                <Text style={[styles.currLabel, ff('600'), { color: colors.subtext ?? '#8E8E93' }]}>{t.currentKHR}</Text>
                <Text style={[capital.capitalKHR > 0 ? styles.currValue : styles.currNotSet, ff('400'), { color: capital.capitalKHR > 0 ? colors.text : (colors.subtext ?? '#8E8E93') }]}>
                  {capital.capitalKHR > 0 ? fmtKHR(capital.capitalKHR) : t.notSet}
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* ── Edit form ────────────────────────────────────────── */}
          {editing && (
            <GlassCard style={styles.card}>
              <View style={{ padding: 16, gap: 12 }}>
                <View style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderColor: 'rgba(120,120,128,0.2)' }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }, fi()]}
                    value={usdInput}
                    onChangeText={setUsdInput}
                    placeholder={t.capitalUSD}
                    placeholderTextColor={colors.subtext ?? '#8E8E93'}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderColor: 'rgba(120,120,128,0.2)' }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }, fi()]}
                    value={khrInput}
                    onChangeText={setKhrInput}
                    placeholder={t.capitalKHR}
                    placeholderTextColor={colors.subtext ?? '#8E8E93'}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
                <Text style={[styles.hint, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>{t.capitalHint}</Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btn, { borderWidth: 1, borderColor: 'rgba(120,120,128,0.3)' }]}
                    onPress={() => setEditing(false)}
                  >
                    <Text style={[styles.btnText, ff('600'), { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: ACCENT }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={[styles.btnText, ff('600'), { color: '#fff' }]}>{t.save}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          )}

          {/* ── History ──────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, ff('700'), { color: colors.subtext ?? '#8E8E93' }]}>{t.history}</Text>

          {history.length === 0 ? (
            <GlassCard style={styles.card}>
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[styles.emptyText, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>{t.noHistory}</Text>
              </View>
            </GlassCard>
          ) : (
            history.map((entry, idx) => (
              <GlassCard key={entry.id} style={[styles.historyCard, idx === history.length - 1 && { marginBottom: 0 }]}>
                <View style={styles.historyInner}>
                  {/* Left: name + time */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <View style={[styles.avatarDot, { backgroundColor: ACCENT + '33' }]}>
                        <Ionicons name="person-outline" size={12} color={ACCENT} />
                      </View>
                      <Text style={[styles.historyName, ff('400'), { color: colors.text }]} numberOfLines={1}>
                        {entry.updatedByName ?? '—'}
                      </Text>
                    </View>
                    <Text style={[styles.historyTime, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>
                      {fmtDateTime(entry.updatedAt)}
                    </Text>
                  </View>
                  {/* Right: amounts */}
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    {entry.capitalUSD > 0 && (
                      <Text style={[styles.historyAmt, ff('700'), { color: GREEN }]}>
                        {fmtUSD(entry.capitalUSD)}
                      </Text>
                    )}
                    {entry.capitalKHR > 0 && (
                      <Text style={[styles.historyAmt, ff('700'), { color: GREEN }]}>
                        {fmtKHR(entry.capitalKHR)}
                      </Text>
                    )}
                    {!entry.capitalUSD && !entry.capitalKHR && (
                      <Text style={[styles.historyAmt, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>0</Text>
                    )}
                  </View>
                </View>
              </GlassCard>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (fs, ff, language) => {
  const km = true;
  return StyleSheet.create({
  safe:  { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 8, paddingRight: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn:      { padding: 4 },
  headerTitle:  { flex: 1, fontSize: fs(22), letterSpacing: 0, lineHeight: km ? 44 : 34, paddingLeft: 4 },
  editBtn:      { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText:  { fontSize: fs(15), letterSpacing: 0, lineHeight: km ? 26 : 20 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  // Current card
  card:         { marginBottom: 16 },
  currentRow:   { flexDirection: 'row', alignItems: 'center', padding: 20 },
  currentCol:   { flex: 1 },
  currentDivider: { width: 1, height: 44, marginHorizontal: 16 },
  currLabel:    { fontSize: fs(13), letterSpacing: 0, lineHeight: km ? 31 : 24, marginBottom: 6 },
  currValue:    { fontSize: fs(22), letterSpacing: 0, lineHeight: km ? 44 : 34 },
  currNotSet:   { fontSize: fs(14), letterSpacing: 0, lineHeight: km ? 25 : 19 },

  // Edit form
  inputWrap:    { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  input:        { height: 48, paddingHorizontal: 14, fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0 },
  hint:         { fontSize: fs(12), letterSpacing: 0, lineHeight: km ? 21 : 16, textAlign: 'center' },
  btnRow:       { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:          { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText:      { fontSize: fs(15), letterSpacing: 0, lineHeight: km ? 26 : 20 },

  // History
  sectionTitle: { fontSize: fs(11), letterSpacing: 0, lineHeight: km ? 20 : 15, marginBottom: 10, marginTop: 8, paddingHorizontal: 2 },
  emptyText:    { fontSize: fs(13), letterSpacing: 0, lineHeight: km ? 23 : 18 },
  historyCard:  { marginBottom: 10 },
  historyInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatarDot:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  historyName:  { fontSize: fs(14), letterSpacing: 0, lineHeight: km ? 25 : 19 },
  historyTime:  { fontSize: fs(11), letterSpacing: 0, lineHeight: km ? 20 : 15, marginTop: 1 },
  historyAmt:   { fontSize: fs(14), letterSpacing: 0, lineHeight: km ? 25 : 19 },
});
};
