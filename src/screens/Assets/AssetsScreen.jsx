/**
 * ASSETS SCREEN — Portfolio overview + external investments tracker
 *
 * Sections:
 *   1. Summary card: total assets in USD + KHR (loans + investments)
 *   2. Loan Portfolio: outstanding principal auto-pulled from DataContext
 *   3. Investments: manually added external investments with add/edit/delete
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import CalendarPopup from '../../components/CalendarPopup';
import {
  listenInvestments,
  addInvestment,
  updateInvestment,
  deleteInvestment,
} from '../../services/investmentService';
import { listenCapital } from '../../services/capitalService';

const ACCENT = '#00C2B2';
const GREEN  = '#10B981';
const RED    = '#EF4444';

// ── i18n ──────────────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Assets',
    overview: 'PORTFOLIO OVERVIEW',
    totalUSD: 'Total Assets (USD)',
    totalKHR: 'Total Assets (KHR)',
    capitalSection: 'CAPITAL',
    loanPortfolio: 'LOAN PORTFOLIO',
    loanSub: n => `${n} active loan${n !== 1 ? 's' : ''}`,
    investments: 'INVESTMENTS',
    noInvestments: 'No investments added yet.\nTap + to add one.',
    addInvestment: 'Add Investment',
    editInvestment: 'Edit Investment',
    name: 'Name',
    namePlaceholder: 'e.g. Gold Fund, Land, Partner Share',
    currency: 'Currency',
    principal: 'Amount Invested',
    monthlyReturn: 'Monthly Return',
    totalPeriods: 'Duration (months)',
    startDate: 'Start Date',
    notes: 'Notes',
    notesPlaceholder: 'Optional',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Delete Investment?',
    confirmDeleteMsg: 'This will permanently remove this investment record.',
    progress: (done, total) => `${done} / ${total} months`,
    matured: 'Matured',
    active: 'Active',
    invested: 'Invested',
    monthly: '/mo',
    netGain: 'Net Gain',
    errName: 'Please enter a name.',
    errPrincipal: 'Please enter the amount invested.',
    errMonthly: 'Please enter the monthly return.',
    errPeriods: 'Please enter the duration in months.',
  },
  km: {
    title: 'ទ្រព្យ',
    overview: 'ទិដ្ឋភាពផតហ្វូលីយ៉ូ',
    totalUSD: 'ទ្រព្យសរុប (USD)',
    totalKHR: 'ទ្រព្យសរុប (KHR)',
    capitalSection: 'ដើមទុន',
    loanPortfolio: 'ផតហ្វូលីយ៉ូប្រាក់កម្ចី',
    loanSub: n => `ប្រាក់កម្ចី ${n}`,
    investments: 'វិនិយោគ',
    noInvestments: 'មិនទាន់មានការវិនិយោគ\nចុច + ដើម្បីបន្ថែម',
    addInvestment: 'បន្ថែមការវិនិយោគ',
    editInvestment: 'កែការវិនិយោគ',
    name: 'ឈ្មោះ',
    namePlaceholder: 'ឧ. មាស, ដី, ហ៊ុន',
    currency: 'រូបិយប័ណ្ណ',
    principal: 'ទឹកប្រាក់វិនិយោគ',
    monthlyReturn: 'ប្រាក់ចំណូលប្រចាំខែ',
    totalPeriods: 'រយៈពេល (ខែ)',
    startDate: 'កាលបរិច្ឆេទចាប់ផ្ដើម',
    notes: 'កំណត់ចំណាំ',
    notesPlaceholder: 'ជម្រើស',
    save: 'រក្សាទុក',
    cancel: 'បោះបង់',
    delete: 'លុប',
    confirmDelete: 'លុបការវិនិយោគ?',
    confirmDeleteMsg: 'វានឹងលុបទិន្នន័យការវិនិយោគនេះជាអចិន្ត្រៃ។',
    progress: (done, total) => `${done} / ${total} ខែ`,
    matured: 'ផុតកំណត់',
    active: 'ដំណើរការ',
    invested: 'វិនិយោគ',
    monthly: '/ខែ',
    netGain: 'ចំណេញ',
    errName: 'សូមវាយឈ្មោះ',
    errPrincipal: 'សូមវាយទឹកប្រាក់',
    errMonthly: 'សូមវាយប្រាក់ចំណូលប្រចាំខែ',
    errPeriods: 'សូមវាយរយៈពេល',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthsElapsed(startDateStr) {
  if (!startDateStr) return 0;
  const [y, m, day] = startDateStr.split('-').map(Number);
  const start = new Date(y, m - 1, day);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
}

function fmtUSD(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function fmtKHR(n) { return '៛' + Math.round(n).toLocaleString(); }
function fmt(currency, n) { return currency === 'KHR' ? fmtKHR(n) : fmtUSD(n); }

// ── Blank form ────────────────────────────────────────────────────────────────

const BLANK = { name: '', currency: 'USD', principal: '', monthlyReturn: '', totalPeriods: '', startDate: todayStr(), notes: '' };

// ── ToggleGroup ───────────────────────────────────────────────────────────────

function ToggleGroup({ options, value, onChange, ff, fs, colors, isDark }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1, paddingVertical: 9, borderRadius: 10,
              alignItems: 'center',
              backgroundColor: active ? ACCENT : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
              borderWidth: 1,
              borderColor: active ? ACCENT : 'rgba(120,120,128,0.22)',
            }}
          >
            <Text style={[{ fontSize: fs(13), letterSpacing: 0, lineHeight: 18, color: active ? '#fff' : colors.text }, ff(active ? '600' : '400')]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Investment card ───────────────────────────────────────────────────────────

function InvestmentCard({ inv, t, ff, fs, colors, onPress }) {
  const elapsed   = monthsElapsed(inv.startDate);
  const total     = Number(inv.totalPeriods) || 0;
  const done      = Math.min(elapsed, total);
  const pct       = total > 0 ? done / total : 0;
  const isMatured = elapsed >= total && total > 0;
  const totalReturn = (Number(inv.monthlyReturn) || 0) * total;
  const profit    = totalReturn - (Number(inv.principal) || 0);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard style={{ marginBottom: 12 }}>
        <View style={{ padding: 16 }}>
          {/* Name + status badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[{ flex: 1, fontSize: fs(15), letterSpacing: 0, lineHeight: 20, color: colors.text }, ff('400')]} numberOfLines={1}>
              {inv.name}
            </Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
              backgroundColor: isMatured ? 'rgba(107,114,128,0.15)' : 'rgba(16,185,129,0.15)',
            }}>
              <Text style={[{ fontSize: fs(11), letterSpacing: 0, lineHeight: 15, color: isMatured ? '#6B7280' : GREEN }, ff('600')]}>
                {isMatured ? t.matured : t.active}
              </Text>
            </View>
          </View>

          {/* Three columns: invested | monthly | gain */}
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: fs(11), letterSpacing: 0, lineHeight: 15, color: colors.subtext ?? '#8E8E93' }, ff('400')]}>
                {t.invested}
              </Text>
              <Text style={[{ fontSize: fs(15), letterSpacing: 0, lineHeight: 20, color: colors.text }, ff('700')]}>
                {fmt(inv.currency, inv.principal ?? 0)}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[{ fontSize: fs(11), letterSpacing: 0, lineHeight: 15, color: colors.subtext ?? '#8E8E93' }, ff('400')]}>
                {t.monthly}
              </Text>
              <Text style={[{ fontSize: fs(15), letterSpacing: 0, lineHeight: 20, color: ACCENT }, ff('700')]}>
                {fmt(inv.currency, inv.monthlyReturn ?? 0)}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: fs(11), letterSpacing: 0, lineHeight: 15, color: colors.subtext ?? '#8E8E93' }, ff('400')]}>
                {t.netGain}
              </Text>
              <Text style={[{ fontSize: fs(15), letterSpacing: 0, lineHeight: 20, color: profit >= 0 ? GREEN : RED }, ff('700')]}>
                {profit >= 0 ? '+' : ''}{fmt(inv.currency, profit)}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ height: 5, backgroundColor: 'rgba(120,120,128,0.15)', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
            <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: isMatured ? '#6B7280' : ACCENT, borderRadius: 3 }} />
          </View>
          <Text style={[{ fontSize: fs(11), letterSpacing: 0, lineHeight: 15, color: colors.subtext ?? '#8E8E93' }, ff('400')]}>
            {t.progress(done, total)}
          </Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AssetsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff), [fs, ff]);

  const { loans } = useData();
  const [investments, setInvestments] = useState([]);
  const [capital, setCapital]         = useState({ capitalUSD: 0, capitalKHR: 0 });

  // Form / modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState(BLANK);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => listenInvestments(setInvestments), []);
  useEffect(() => listenCapital(setCapital), []);

  // ── Loan totals ───────────────────────────────────────────────────────────
  const loanStats = useMemo(() => {
    const open    = loans.filter(l => l.status !== 'paid' && l.status !== 'written_off');
    const usdOpen = open.filter(l => l.currency === 'USD');
    const khrOpen = open.filter(l => l.currency === 'KHR');
    return {
      usdAmt: usdOpen.reduce((s, l) => s + (l.currentPrincipal ?? 0), 0),
      khrAmt: khrOpen.reduce((s, l) => s + (l.currentPrincipal ?? 0), 0),
      usdCnt: usdOpen.length,
      khrCnt: khrOpen.length,
    };
  }, [loans]);

  // ── Investment totals ─────────────────────────────────────────────────────
  const invStats = useMemo(() => {
    const usdInv = investments.filter(i => i.currency === 'USD');
    const khrInv = investments.filter(i => i.currency === 'KHR');
    return {
      usdAmt: usdInv.reduce((s, i) => s + (Number(i.principal) || 0), 0),
      khrAmt: khrInv.reduce((s, i) => s + (Number(i.principal) || 0), 0),
    };
  }, [investments]);

  const grandUSD = loanStats.usdAmt + invStats.usdAmt + capital.capitalUSD;
  const grandKHR = loanStats.khrAmt + invStats.khrAmt + capital.capitalKHR;

  // ── Form helpers ──────────────────────────────────────────────────────────
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...BLANK, startDate: todayStr() });
    setModalVisible(true);
  };

  const openEdit = (inv) => {
    setEditingId(inv.id);
    setForm({
      name:          inv.name ?? '',
      currency:      inv.currency ?? 'USD',
      principal:     String(inv.principal ?? ''),
      monthlyReturn: String(inv.monthlyReturn ?? ''),
      totalPeriods:  String(inv.totalPeriods ?? ''),
      startDate:     inv.startDate ?? todayStr(),
      notes:         inv.notes ?? '',
    });
    setModalVisible(true);
  };

  const closeModal = () => { setModalVisible(false); setShowDatePicker(false); };

  const validate = () => {
    if (!form.name.trim())                           { Alert.alert('', t.errName);      return false; }
    if (!form.principal || isNaN(+form.principal))   { Alert.alert('', t.errPrincipal); return false; }
    if (!form.monthlyReturn || isNaN(+form.monthlyReturn)) { Alert.alert('', t.errMonthly);   return false; }
    if (!form.totalPeriods || isNaN(+form.totalPeriods))   { Alert.alert('', t.errPeriods);   return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        name:          form.name.trim(),
        currency:      form.currency,
        principal:     Number(form.principal),
        monthlyReturn: Number(form.monthlyReturn),
        totalPeriods:  Number(form.totalPeriods),
        startDate:     form.startDate,
        notes:         form.notes.trim(),
      };
      if (editingId) await updateInvestment(editingId, data);
      else           await addInvestment(data);
      closeModal();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(t.confirmDelete, t.confirmDeleteMsg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          try { await deleteInvestment(editingId); closeModal(); }
          catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, ff('700'), { color: colors.text }]}>{t.title}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary ─────────────────────────────────────────── */}
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryInner}>
            <Text style={[styles.sectionTitle, ff('700'), { color: colors.text, marginBottom: 14 }]}>{t.overview}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={[styles.summaryLabel, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>{t.totalUSD}</Text>
                <Text style={[styles.summaryValue, ff('700'), { color: colors.text }]}>{fmtUSD(grandUSD)}</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: 'rgba(120,120,128,0.2)' }]} />
              <View style={[styles.summaryCol, { alignItems: 'flex-end' }]}>
                <Text style={[styles.summaryLabel, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>{t.totalKHR}</Text>
                <Text style={[styles.summaryValue, ff('700'), { color: colors.text }]}>{fmtKHR(grandKHR)}</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* ── Capital ──────────────────────────────────────────── */}
        {(capital.capitalUSD > 0 || capital.capitalKHR > 0) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, ff('700'), { color: colors.text }]}>{t.capitalSection}</Text>
            </View>
            <GlassCard style={styles.card}>
              <View style={styles.cardInner}>
                {capital.capitalUSD > 0 && (
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, ff('500'), { color: colors.text, flex: 1 }]}>USD</Text>
                    <Text style={[styles.statValue, ff('700'), { color: GREEN }]}>{fmtUSD(capital.capitalUSD)}</Text>
                  </View>
                )}
                {capital.capitalUSD > 0 && capital.capitalKHR > 0 && (
                  <View style={[styles.divider, { backgroundColor: 'rgba(120,120,128,0.1)' }]} />
                )}
                {capital.capitalKHR > 0 && (
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, ff('500'), { color: colors.text, flex: 1 }]}>KHR</Text>
                    <Text style={[styles.statValue, ff('700'), { color: GREEN }]}>{fmtKHR(capital.capitalKHR)}</Text>
                  </View>
                )}
              </View>
            </GlassCard>
          </>
        )}

        {/* ── Loan Portfolio ───────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, ff('700'), { color: colors.text }]}>{t.loanPortfolio}</Text>
        </View>
        <GlassCard style={styles.card}>
          <View style={styles.cardInner}>
            {/* USD row */}
            <View style={styles.statRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statLabel, ff('500'), { color: colors.text }]}>USD</Text>
                <Text style={[styles.statSub, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>{t.loanSub(loanStats.usdCnt)}</Text>
              </View>
              <Text style={[styles.statValue, ff('700'), { color: ACCENT }]}>{fmtUSD(loanStats.usdAmt)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: 'rgba(120,120,128,0.1)' }]} />
            {/* KHR row */}
            <View style={styles.statRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statLabel, ff('500'), { color: colors.text }]}>KHR</Text>
                <Text style={[styles.statSub, ff('400'), { color: colors.subtext ?? '#8E8E93' }]}>{t.loanSub(loanStats.khrCnt)}</Text>
              </View>
              <Text style={[styles.statValue, ff('700'), { color: ACCENT }]}>{fmtKHR(loanStats.khrAmt)}</Text>
            </View>
          </View>
        </GlassCard>

        {/* ── Investments ──────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, ff('700'), { color: colors.text }]}>{t.investments}</Text>
          <TouchableOpacity onPress={openAdd} style={styles.sectionAddBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add-circle" size={24} color={ACCENT} />
          </TouchableOpacity>
        </View>

        {investments.length === 0 ? (
          <GlassCard style={styles.card}>
            <View style={[styles.cardInner, { alignItems: 'center', paddingVertical: 28 }]}>
              <Ionicons name="wallet-outline" size={36} color={colors.subtext ?? '#8E8E93'} />
              <Text style={[styles.emptyText, ff('400'), { color: colors.subtext ?? '#8E8E93', marginTop: 10 }]}>
                {t.noInvestments}
              </Text>
            </View>
          </GlassCard>
        ) : (
          investments.map(inv => (
            <InvestmentCard
              key={inv.id}
              inv={inv}
              t={t}
              ff={ff}
              fs={fs}
              colors={colors}
              onPress={() => openEdit(inv)}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={openAdd}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit bottom sheet */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.sheet, {
            backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
            paddingBottom: insets.bottom + 16,
          }]}>
            <View style={[styles.handle, { backgroundColor: 'rgba(120,120,128,0.35)' }]} />

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, ff('700'), { color: colors.text }]}>
                {editingId ? t.editInvestment : t.addInvestment}
              </Text>
              {editingId && (
                <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={20} color={RED} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.name}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: 'rgba(120,120,128,0.25)', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}
                value={form.name}
                onChangeText={v => set('name', v)}
                placeholder={t.namePlaceholder}
                placeholderTextColor={colors.subtext ?? '#8E8E93'}
              />

              {/* Currency */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.currency}</Text>
              <ToggleGroup
                options={[{ label: 'USD ($)', value: 'USD' }, { label: 'KHR (៛)', value: 'KHR' }]}
                value={form.currency}
                onChange={v => set('currency', v)}
                ff={ff} fs={fs} colors={colors} isDark={isDark}
              />

              {/* Amount Invested */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.principal}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: 'rgba(120,120,128,0.25)', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}
                value={form.principal}
                onChangeText={v => set('principal', v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.subtext ?? '#8E8E93'}
              />

              {/* Monthly Return */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.monthlyReturn}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: 'rgba(120,120,128,0.25)', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}
                value={form.monthlyReturn}
                onChangeText={v => set('monthlyReturn', v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.subtext ?? '#8E8E93'}
              />

              {/* Duration */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.totalPeriods}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: 'rgba(120,120,128,0.25)', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}
                value={form.totalPeriods}
                onChangeText={v => set('totalPeriods', v)}
                keyboardType="numeric"
                placeholder="12"
                placeholderTextColor={colors.subtext ?? '#8E8E93'}
              />

              {/* Start Date */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.startDate}</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateRow, { borderColor: 'rgba(120,120,128,0.25)', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[{ fontSize: fs(15), letterSpacing: 0, lineHeight: 20, color: colors.text }, ff('400')]}>
                  {form.startDate}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.subtext ?? '#8E8E93'} />
              </TouchableOpacity>

              {/* Notes */}
              <Text style={[styles.fieldLabel, ff('600'), { color: colors.text }]}>{t.notes}</Text>
              <TextInput
                style={[styles.input, {
                  color: colors.text,
                  borderColor: 'rgba(120,120,128,0.25)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
                  minHeight: 64,
                  textAlignVertical: 'top',
                }]}
                value={form.notes}
                onChangeText={v => set('notes', v)}
                placeholder={t.notesPlaceholder}
                placeholderTextColor={colors.subtext ?? '#8E8E93'}
                multiline
              />

              {/* Action buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, { borderWidth: 1, borderColor: 'rgba(120,120,128,0.3)', backgroundColor: 'transparent' }]}
                  onPress={closeModal}
                >
                  <Text style={[styles.btnText, ff('600'), { color: colors.text }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: ACCENT }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={[styles.btnText, ff('600'), { color: '#fff' }]}>{t.save}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Calendar date picker */}
      <CalendarPopup
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={form.startDate}
        onChange={d => { set('startDate', d); setShowDatePicker(false); }}
        accentColor={ACCENT}
        colors={colors}
        isDark={isDark}
        language={language}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (fs, ff) => StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: { padding: 4, marginRight: 4 },
  headerTitle: { fontSize: fs(28), letterSpacing: 0, lineHeight: 34 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  // Summary
  summaryCard:  { marginBottom: 20 },
  summaryInner: { padding: 18 },
  summaryRow:   { flexDirection: 'row', alignItems: 'center' },
  summaryCol:   { flex: 1 },
  summaryDivider: { width: 1, height: 40, marginHorizontal: 16 },
  summaryLabel: { fontSize: fs(12), letterSpacing: 0, lineHeight: 16, marginBottom: 4 },
  summaryValue: { fontSize: fs(22), letterSpacing: 0, lineHeight: 28 },

  // Section header
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle:    { flex: 1, fontSize: fs(11), letterSpacing: 0, lineHeight: 15 },
  sectionAddBtn:   {},

  // Loan portfolio card
  card:     { marginBottom: 20 },
  cardInner: { padding: 16 },
  statRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  statLabel: { fontSize: fs(15), letterSpacing: 0, lineHeight: 20 },
  statSub:   { fontSize: fs(11), letterSpacing: 0, lineHeight: 15, marginTop: 1 },
  statValue: { fontSize: fs(18), letterSpacing: 0, lineHeight: 23 },
  divider:   { height: 1, marginVertical: 4 },

  emptyText: { fontSize: fs(13), letterSpacing: 0, lineHeight: 18, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },

  // Modal / sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetTitle:  { flex: 1, fontSize: fs(18), letterSpacing: 0, lineHeight: 23 },
  fieldLabel:  { fontSize: fs(13), letterSpacing: 0, lineHeight: 18, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: fs(15), lineHeight: 20, letterSpacing: 0, ...ff('400'),
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btnRow:  { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 8 },
  btn:     { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { fontSize: fs(15), letterSpacing: 0, lineHeight: 20 },
});
