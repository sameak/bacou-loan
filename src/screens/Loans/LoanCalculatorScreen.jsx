/**
 * LOAN CALCULATOR SCREEN — Estimate a loan before creating it
 * Supports export as PDF (expo-print) and JPG (react-native-view-shot)
 */

import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useRef, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency, generateSchedule, today } from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import CalendarPopup from '../../components/CalendarPopup';

const ACCENT = '#6366F1';
const CURRENCIES = ['USD', 'KHR', 'KRW'];

const T = {
  en: {
    title: 'Loan Calculator',
    close: 'Close',
    currency: 'CURRENCY',
    principalLabel: 'PRINCIPAL AMOUNT',
    principalPlaceholder: '1,000',
    repaymentType: 'REPAYMENT TYPE',
    interestOnly: 'Interest Only',
    principalAndInterest: 'Principal + Interest',
    interestBasis: 'INTEREST BASIS',
    flat: 'Flat',
    reducing: 'Reducing Balance',
    rate: 'INTEREST RATE (% per period)',
    ratePlaceholder: '3',
    frequency: 'FREQUENCY',
    weekly: 'Weekly',
    monthly: 'Monthly',
    schedule: 'SCHEDULE',
    fixed: 'Fixed Periods',
    open: 'Open-Ended',
    periods: 'NUMBER OF PERIODS',
    periodsPlaceholder: '12',
    startDate: 'START DATE',
    preview: 'PREVIEW PERIODS',
    previewPlaceholder: '12',
    summary: 'SUMMARY',
    totalInterest: 'Total Interest',
    totalPayment: 'Total Repayment',
    perPeriod: 'Per Period',
    perMonth: 'Per Period',
    colPeriod: '#',
    colDate: 'Due Date',
    colPrincipal: 'Principal',
    colInterest: 'Interest',
    colTotal: 'Total',
    scheduleTitle: 'PAYMENT SCHEDULE',
    previewNote: 'period projection',
    fillInForm: 'Enter principal & rate above\nto see your loan estimate',
    exportPdf: 'Export PDF',
    exportJpg: 'Save Image',
    exporting: 'Exporting…',
    exportError: 'Export failed',
    pdfFooter: 'Bacou Loan Manager · Estimate only — not a binding agreement',
    pdfProjection: 'Projection',
  },
  km: {
    title: 'គណនាប្រាក់កម្ចី',
    close: 'បិទ',
    currency: 'រូបិយប័ណ្ណ',
    principalLabel: 'ចំនួនទឹកប្រាក់',
    principalPlaceholder: '1,000',
    repaymentType: 'ប្រភេទការបង់',
    interestOnly: 'បង់តែការប្រាក់',
    principalAndInterest: 'ប្រាក់ដើម + ការប្រាក់',
    interestBasis: 'មូលដ្ឋានការប្រាក់',
    flat: 'ការប្រាក់ថេរ',
    reducing: 'ការប្រាក់ថយ',
    rate: 'អត្រាការប្រាក់ (% ក្នុងដំណាក់)',
    ratePlaceholder: '3',
    frequency: 'ភាពញឹកញាប់',
    weekly: 'ប្រចាំសប្ដាហ៍',
    monthly: 'ប្រចាំខែ',
    schedule: 'កាលវិភាគ',
    fixed: 'ចំនួនដំណាក់ថេរ',
    open: 'បើក',
    periods: 'ចំនួនដំណាក់',
    periodsPlaceholder: '12',
    startDate: 'ថ្ងៃចាប់ផ្ដើម',
    preview: 'ចំនួនដំណាក់បង្ហាញ',
    previewPlaceholder: '12',
    summary: 'សង្ខេប',
    totalInterest: 'ការប្រាក់សរុប',
    totalPayment: 'ការបង់សរុប',
    perPeriod: 'ក្នុងដំណាក់',
    perMonth: 'ក្នុងដំណាក់',
    colPeriod: '#',
    colDate: 'ថ្ងៃ',
    colPrincipal: 'ដើម',
    colInterest: 'ការប្រាក់',
    colTotal: 'សរុប',
    scheduleTitle: 'កាលវិភាគ',
    previewNote: 'ដំណាក់',
    fillInForm: 'បំពេញចំនួនទឹកប្រាក់ និងអត្រាខាងលើ\nដើម្បីមើលការប៉ាន់ស្មាន',
    exportPdf: 'នាំចេញ PDF',
    exportJpg: 'រក្សាទុករូបភាព',
    exporting: 'កំពុងនាំចេញ…',
    exportError: 'មានបញ្ហា',
    pdfFooter: 'Bacou Loan Manager · ការប៉ាន់ស្មានតែប៉ុណ្ណោះ',
    pdfProjection: 'ការបង្ហាញ',
  },
};

// ── ToggleGroup ────────────────────────────────────────────────────────────────
const ToggleGroup = ({ options, value, onChange, colors, isDark, ff }) => (
  <View style={[
    { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 4 },
    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
  ]}>
    {options.map(opt => {
      const active = value === opt.value;
      return (
        <TouchableOpacity
          key={opt.value}
          style={[
            { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
            active && { backgroundColor: isDark ? '#fff' : '#1C1C1E' },
          ]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
        >
          <Text style={[
            { fontSize: 13, lineHeight: 18, ...ff('600') },
            { color: active ? (isDark ? '#000' : '#fff') : colors.textMuted },
          ]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ── Build PDF HTML ─────────────────────────────────────────────────────────────
function buildHtml({ principal, rate, currency, repaymentType, interestBasis, frequency,
  scheduleMode, startDate, calc, showPrincipalCol, t, previewPeriods }) {
  const p = Number(principal.replace(/,/g, ''));
  const isPreview = calc.isPreview;
  const scheduleRows = calc.schedule.map((row, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="text-align:left;color:#6b7280">${row.periodNumber}</td>
      <td style="text-align:left;color:#6b7280">${row.dueDate}</td>
      ${showPrincipalCol ? `<td>${formatCurrency(row.principalDue, currency)}</td>` : ''}
      <td style="color:#d97706;font-weight:600">${formatCurrency(row.interestDue, currency)}</td>
      <td style="font-weight:700">${formatCurrency(row.totalDue, currency)}</td>
    </tr>`).join('');

  const principalColHead = showPrincipalCol
    ? `<th style="text-align:right">${t.colPrincipal}</th>` : '';

  const params = [
    `<b>Principal:</b> ${formatCurrency(p, currency)}`,
    `<b>Rate:</b> ${rate}% / period`,
    `<b>Type:</b> ${repaymentType === 'interest_only' ? 'Interest Only' : 'Principal + Interest'}`,
    `<b>Basis:</b> ${interestBasis === 'flat' ? 'Flat' : 'Reducing Balance'}`,
    `<b>Frequency:</b> ${frequency === 'monthly' ? 'Monthly' : 'Weekly'}`,
    `<b>Start:</b> ${startDate}`,
    isPreview
      ? `<b>${t.pdfProjection}:</b> ${previewPeriods} periods`
      : `<b>Periods:</b> ${calc.schedule.length}`,
  ].map(s => `<span class="param">${s}</span>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:28px 32px;color:#111827;font-size:13px}
  h1{font-size:24px;font-weight:800;color:#6366F1;margin:0 0 4px}
  .sub{font-size:12px;color:#9ca3af;margin:0 0 20px}
  .params{background:#f9fafb;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px 24px}
  .param{font-size:12px;color:#374151}
  .cards{display:flex;gap:12px;margin-bottom:20px}
  .card{flex:1;background:#f9fafb;border-radius:10px;padding:14px 16px;border:1px solid #f3f4f6}
  .clabel{font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px}
  .cval{font-size:19px;font-weight:800}
  .cv-interest{color:#d97706}.cv-total{color:#6366F1}.cv-period{color:#111827}
  .preview-note{font-size:11px;color:#9ca3af;font-style:italic;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead tr{background:#6366F1}
  thead th{color:#fff;padding:9px 10px;font-weight:700;font-size:11px;text-transform:uppercase;text-align:right}
  thead th:first-child,thead th:nth-child(2){text-align:left}
  tbody td{padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right}
  .footer{margin-top:28px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #f3f4f6;padding-top:14px}
</style></head><body>
  <h1>Loan Estimate</h1>
  <p class="sub">Generated ${today()} &nbsp;·&nbsp; Bacou Loan Manager</p>
  <div class="params">${params}</div>
  <div class="cards">
    <div class="card"><div class="clabel">Total Interest</div><div class="cval cv-interest">${formatCurrency(calc.totalInterest, currency)}</div></div>
    <div class="card"><div class="clabel">Total Repayment</div><div class="cval cv-total">${formatCurrency(calc.totalPayment, currency)}</div></div>
    <div class="card"><div class="clabel">Per Period</div><div class="cval cv-period">${formatCurrency(calc.schedule[0]?.totalDue ?? 0, currency)}</div></div>
  </div>
  ${isPreview ? `<p class="preview-note">* Projection only — amounts may vary for open-ended loans</p>` : ''}
  <table>
    <thead><tr>
      <th style="text-align:left">#</th>
      <th style="text-align:left">Due Date</th>
      ${principalColHead}
      <th style="text-align:right">Interest</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${scheduleRows}</tbody>
  </table>
  <div class="footer">${t.pdfFooter}</div>
</body></html>`;
}

// ── Screen ─────────────────────────────────────────────────────────────────────
const LoanCalculatorScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, fs, ff, fi } = useLanguage();
  const t = T[language] || T.en;
  const isKhmer = language === 'km';
  const styles = useMemo(() => makeStyles(fs, ff, isKhmer), [fs, ff, isKhmer]);

  const [currency, setCurrency] = useState('USD');
  const [principal, setPrincipal] = useState('');
  const [repaymentType, setRepaymentType] = useState('interest_only');
  const [interestBasis, setInterestBasis] = useState('flat');
  const [rate, setRate] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [scheduleMode, setScheduleMode] = useState('fixed');
  const [periods, setPeriods] = useState('12');
  const [previewPeriods, setPreviewPeriods] = useState('12');
  const [startDate, setStartDate] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exporting, setExporting] = useState(false); // 'pdf' | 'jpg' | false

  const resultsRef = useRef(null);
  const inputBg = isDark ? colors.surface : '#F2F4F8';

  // ── Live calculation ─────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const p = Number(principal.replace(/,/g, ''));
    const r = parseFloat(rate);
    if (!p || !r || p <= 0 || r < 0 || !startDate) return null;

    const n = scheduleMode === 'fixed'
      ? parseInt(periods, 10)
      : parseInt(previewPeriods, 10) || 12;
    if (!n || n <= 0 || n > 600) return null;

    const loan = {
      originalPrincipal: p,
      currentPrincipal: p,
      interestRate: r,
      interestBasis,
      repaymentType,
      frequency,
      startDate,
      totalPeriods: n,
    };

    const schedule = generateSchedule(loan);
    const totalInterest = Math.round(schedule.reduce((s, row) => s + row.interestDue, 0) * 100) / 100;
    const totalPayment  = Math.round(schedule.reduce((s, row) => s + row.totalDue,    0) * 100) / 100;
    return { schedule, totalInterest, totalPayment, isPreview: scheduleMode === 'open' };
  }, [principal, rate, interestBasis, repaymentType, frequency, scheduleMode, periods, previewPeriods, startDate]);

  const showPrincipalCol = repaymentType === 'principal_and_interest';

  // ── Export handlers ──────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!calc || exporting) return;
    setExporting('pdf');
    try {
      const html = buildHtml({ principal, rate, currency, repaymentType, interestBasis,
        frequency, scheduleMode, startDate, calc, showPrincipalCol, t, previewPeriods });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Loan Estimate PDF',
      });
    } catch (e) {
      Alert.alert(t.exportError, e.message || '');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJPG = async () => {
    if (!calc || !resultsRef.current || exporting) return;
    setExporting('jpg');
    try {
      const uri = await captureRef(resultsRef, { format: 'jpg', quality: 0.95 });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: 'Loan Estimate Image',
      });
    } catch (e) {
      Alert.alert(t.exportError, e.message || '');
    } finally {
      setExporting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <SafeAreaView edges={['top']}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>{t.close}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t.title}</Text>
            <View style={styles.headerActions}>
              {/* PDF */}
              <TouchableOpacity
                onPress={handleExportPDF}
                disabled={!calc || !!exporting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                style={{ opacity: calc ? 1 : 0.3 }}
              >
                {exporting === 'pdf'
                  ? <ActivityIndicator size="small" color={ACCENT} />
                  : <Ionicons name="document-text-outline" size={22} color={ACCENT} />
                }
              </TouchableOpacity>
              {/* JPG */}
              <TouchableOpacity
                onPress={handleExportJPG}
                disabled={!calc || !!exporting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                style={{ opacity: calc ? 1 : 0.3 }}
              >
                {exporting === 'jpg'
                  ? <ActivityIndicator size="small" color={colors.text} />
                  : <Ionicons name="image-outline" size={22} color={colors.text} />
                }
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* ── Currency ───────────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.currency}</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.currencyBtn, { backgroundColor: inputBg }, currency === c && { backgroundColor: ACCENT }]}
                onPress={() => setCurrency(c)}
                activeOpacity={0.8}
              >
                <Text style={[styles.currencyText, { color: currency === c ? '#fff' : colors.text }, ff('700')]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Principal ──────────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.principalLabel}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }, fi()]}
            value={principal ? parseInt(principal.replace(/,/g, ''), 10).toLocaleString() : ''}
            onChangeText={v => {
              const raw = v.replace(/,/g, '');
              if (raw === '' || /^\d+$/.test(raw)) setPrincipal(raw);
            }}
            placeholder={t.principalPlaceholder}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />

          {/* ── Repayment type ─────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.repaymentType}</Text>
          <ToggleGroup
            options={[
              { value: 'interest_only',          label: t.interestOnly },
              { value: 'principal_and_interest',  label: t.principalAndInterest },
            ]}
            value={repaymentType} onChange={setRepaymentType} colors={colors} isDark={isDark} ff={ff}
          />

          {/* ── Interest basis ─────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.interestBasis}</Text>
          <ToggleGroup
            options={[
              { value: 'flat',     label: t.flat },
              { value: 'reducing', label: t.reducing },
            ]}
            value={interestBasis} onChange={setInterestBasis} colors={colors} isDark={isDark} ff={ff}
          />

          {/* ── Rate ───────────────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.rate}</Text>
          <View style={[styles.rateWrap, { backgroundColor: inputBg }]}>
            <TextInput
              style={[styles.rateInput, { color: colors.text }, fi()]}
              value={rate}
              onChangeText={setRate}
              placeholder={t.ratePlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.rateSuffix, { color: colors.textMuted }, ff('700')]}>%</Text>
          </View>

          {/* ── Frequency ──────────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.frequency}</Text>
          <ToggleGroup
            options={[
              { value: 'weekly',  label: t.weekly },
              { value: 'monthly', label: t.monthly },
            ]}
            value={frequency} onChange={setFrequency} colors={colors} isDark={isDark} ff={ff}
          />

          {/* ── Schedule mode ──────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.schedule}</Text>
          <ToggleGroup
            options={[
              { value: 'fixed', label: t.fixed },
              { value: 'open',  label: t.open },
            ]}
            value={scheduleMode} onChange={setScheduleMode} colors={colors} isDark={isDark} ff={ff}
          />

          {/* ── Periods ────────────────────────────────────────────────────── */}
          {scheduleMode === 'fixed' ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t.periods}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: colors.text }, fi()]}
                value={periods}
                onChangeText={v => setPeriods(v.replace(/\D/g, ''))}
                placeholder={t.periodsPlaceholder}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t.preview}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: colors.text }, fi()]}
                value={previewPeriods}
                onChangeText={v => setPreviewPeriods(v.replace(/\D/g, ''))}
                placeholder={t.previewPlaceholder}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </>
          )}

          {/* ── Start date ─────────────────────────────────────────────────── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.startDate}</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBg, justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[{ color: colors.text }, { fontSize: fs(15), lineHeight: 20, ...ff('400') }]}>
              {startDate}
            </Text>
          </TouchableOpacity>

          {/* ── Results ────────────────────────────────────────────────────── */}
          {!calc ? (
            <View style={styles.emptyResults}>
              <Ionicons name="calculator-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t.fillInForm}</Text>
            </View>
          ) : (
            <>
              {/* Capturable results section */}
              <View
                ref={resultsRef}
                collapsable={false}
                style={[styles.resultsCapture, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}
              >
                {/* Loan params strip */}
                <View style={[styles.paramsStrip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.paramText, { color: colors.textMuted }]}>
                    {formatCurrency(Number(principal.replace(/,/g, '')), currency)}
                    {'  ·  '}{rate}% / {frequency === 'monthly' ? t.monthly : t.weekly}
                    {'  ·  '}{repaymentType === 'interest_only' ? t.interestOnly : t.principalAndInterest}
                    {'  ·  '}{interestBasis === 'flat' ? t.flat : t.reducing}
                    {calc.isPreview ? `  ·  ${previewPeriods} ${t.previewNote}` : `  ·  ${calc.schedule.length} ${t.periods}`}
                  </Text>
                </View>

                {/* Summary cards */}
                <Text style={[styles.label, { color: colors.textMuted, marginTop: 16, paddingHorizontal: 2 }]}>{t.summary}</Text>
                <View style={styles.summaryRow}>
                  <GlassCard style={{ flex: 1 }}>
                    <View style={styles.summaryInner}>
                      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t.totalInterest}</Text>
                      <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                        {formatCurrency(calc.totalInterest, currency)}
                      </Text>
                    </View>
                  </GlassCard>
                  <GlassCard style={{ flex: 1 }}>
                    <View style={styles.summaryInner}>
                      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t.totalPayment}</Text>
                      <Text style={[styles.summaryValue, { color: ACCENT }]}>
                        {formatCurrency(calc.totalPayment, currency)}
                      </Text>
                    </View>
                  </GlassCard>
                </View>

                <GlassCard>
                  <View style={styles.summaryInner}>
                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                      {scheduleMode === 'fixed' ? t.perPeriod : t.perMonth}
                    </Text>
                    <Text style={[styles.summaryValueLg, { color: colors.text }]}>
                      {formatCurrency(calc.schedule[0]?.totalDue ?? 0, currency)}
                    </Text>
                  </View>
                </GlassCard>

                {/* Schedule table */}
                <Text style={[styles.label, { color: colors.textMuted, marginTop: 20, paddingHorizontal: 2 }]}>
                  {t.scheduleTitle}
                  {calc.isPreview ? `  (${previewPeriods} ${t.previewNote})` : `  (${calc.schedule.length})`}
                </Text>

                <GlassCard>
                  <View style={[styles.tableRow, styles.tableHead, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.thCell, styles.cellNum,  { color: colors.textMuted }]}>{t.colPeriod}</Text>
                    <Text style={[styles.thCell, styles.cellDate, { color: colors.textMuted }]}>{t.colDate}</Text>
                    {showPrincipalCol && (
                      <Text style={[styles.thCell, styles.cellAmt, { color: colors.textMuted }]}>{t.colPrincipal}</Text>
                    )}
                    <Text style={[styles.thCell, styles.cellAmt,   { color: colors.textMuted }]}>{t.colInterest}</Text>
                    <Text style={[styles.thCell, styles.cellTotal, { color: colors.textMuted }]}>{t.colTotal}</Text>
                  </View>

                  {calc.schedule.map((row, index) => (
                    <View
                      key={row.periodNumber}
                      style={[
                        styles.tableRow,
                        index < calc.schedule.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                        index % 2 !== 0 && {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)',
                        },
                      ]}
                    >
                      <Text style={[styles.tdCell, styles.cellNum,  { color: colors.textMuted }]}>{row.periodNumber}</Text>
                      <Text style={[styles.tdCell, styles.cellDate, { color: colors.textMuted }]}>{row.dueDate.slice(5)}</Text>
                      {showPrincipalCol && (
                        <Text style={[styles.tdCell, styles.cellAmt, { color: colors.text }]}>
                          {formatCurrency(row.principalDue, currency)}
                        </Text>
                      )}
                      <Text style={[styles.tdCell, styles.cellAmt,   { color: '#F59E0B' }]}>
                        {formatCurrency(row.interestDue, currency)}
                      </Text>
                      <Text style={[styles.tdCell, styles.cellTotal, { color: colors.text }]}>
                        {formatCurrency(row.totalDue, currency)}
                      </Text>
                    </View>
                  ))}
                </GlassCard>

                {/* Image footer */}
                <Text style={[styles.captureFooter, { color: colors.textMuted }]}>
                  Bacou Loan Manager · {today()}
                </Text>
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <CalendarPopup
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={startDate}
        onChange={v => setStartDate(v)}
        title={t.startDate}
        accentColor={ACCENT}
        colors={colors}
        isDark={isDark}
        language={language}
      />
    </KeyboardAvoidingView>
  );
};

const makeStyles = (fs, ff, isKhmer = false) => StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn:     { width: 56, paddingVertical: 4 },
  headerBtnText: { fontSize: fs(15), lineHeight: 20, ...ff('500') },
  headerTitle:   { fontSize: fs(18), lineHeight: 24, ...ff('700'), letterSpacing: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16, width: 56, justifyContent: 'flex-end' },

  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60, gap: 4 },

  label: {
    fontSize: fs(11), lineHeight: 15, ...ff('700'),
    letterSpacing: 0, marginBottom: 8, marginTop: 12,
  },
  input: {
    height: 52, borderRadius: 14, paddingHorizontal: 16,
    fontSize: fs(15), lineHeight: 20, ...ff('400'),
  },
  rateWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderRadius: 14, paddingHorizontal: 16,
  },
  rateInput:  { flex: 1, fontSize: fs(15), lineHeight: 20, ...ff('400') },
  rateSuffix: { fontSize: fs(16), lineHeight: 22 },

  currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  currencyBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: fs(13), lineHeight: 18 },

  emptyResults: { alignItems: 'center', gap: 12, paddingVertical: 40, marginTop: 16 },
  emptyText: { fontSize: fs(14), lineHeight: 20, ...ff('400'), textAlign: 'center', letterSpacing: 0 },

  // Capturable results wrapper
  resultsCapture: { borderRadius: 16, padding: 16, marginTop: 4, gap: 0 },
  paramsStrip: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  paramText: { fontSize: fs(12), lineHeight: 17, ...ff('400'), letterSpacing: 0 },

  summaryRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryInner:  { padding: 16 },
  summaryLabel:  { fontSize: fs(12), lineHeight: 16, ...ff('500'), letterSpacing: 0, marginBottom: 6 },
  summaryValue:  { fontSize: fs(17), lineHeight: 22, ...ff('800'), letterSpacing: 0 },
  summaryValueLg:{ fontSize: fs(22), lineHeight: 28, ...ff('800'), letterSpacing: 0 },

  captureFooter: {
    textAlign: 'center', fontSize: fs(11), lineHeight: 15,
    ...ff('400'), letterSpacing: 0, marginTop: 14,
  },

  // Table
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  tableHead: { borderBottomWidth: StyleSheet.hairlineWidth },
  thCell: { fontSize: fs(11), lineHeight: 15, ...ff('700'), letterSpacing: 0 },
  tdCell: { fontSize: fs(12), lineHeight: 16, ...ff('400') },
  cellNum:   { width: 26, textAlign: 'right' },
  cellDate:  { flex: 1, paddingLeft: 10 },
  cellAmt:   { width: 68, textAlign: 'right' },
  cellTotal: { width: 76, textAlign: 'right' },
});

export default LoanCalculatorScreen;
