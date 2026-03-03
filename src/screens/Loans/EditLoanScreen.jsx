/**
 * EDIT LOAN SCREEN
 * Editable fields: currency, principal, repaymentType, interestBasis,
 * frequency, scheduleMode, startDate, interestRate, totalPeriods, notes.
 * If schedule-affecting fields changed on a fixed loan, the unpaid schedule
 * entries are regenerated automatically.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { editLoan } from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Toast from '../../components/Toast';
import CalendarPopup from '../../components/CalendarPopup';

const ACCENT = '#6366F1';
const CURRENCIES = ['USD', 'KHR', 'KRW', 'Other'];

const T = {
  en: {
    title: 'Edit Loan',
    cancel: 'Cancel',
    save: 'Save Changes',
    currency: 'CURRENCY',
    currencyLabels: { USD: '🇺🇸 USD', KHR: '🇰🇭 KHR', KRW: '🇰🇷 KRW', Other: '🌐 Other' },
    principal: 'PRINCIPAL AMOUNT',
    principalPlaceholder: '0',
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
    notes: 'NOTES (optional)',
    notesPlaceholder: 'Any notes about this loan...',
    errPrincipal: 'Enter a valid principal amount',
    errRate: 'Enter a valid interest rate',
    errPeriods: 'Enter a valid number of periods',
    errDate: 'Enter a valid start date',
    saved: 'Loan updated',
    scheduleWarning: 'This will regenerate the unpaid payment schedule. Already-paid periods are preserved. Continue?',
    continue: 'Continue',
    cancel2: 'Cancel',
  },
  km: {
    title: 'កែប្រែប្រាក់កម្ចី',
    cancel: 'បោះបង់',
    save: 'រក្សាទុក',
    currency: 'រូបិយប័ណ្ណ',
    currencyLabels: { USD: '🇺🇸 ដុល្លា', KHR: '🇰🇭 រៀល', KRW: '🇰🇷 វ៉ុន', Other: '🌐 ផ្សេងៗ' },
    principal: 'ចំនួនទឹកប្រាក់',
    principalPlaceholder: '0',
    repaymentType: 'ប្រភេទការបង់',
    interestOnly: 'បង់តែការប្រាក់',
    principalAndInterest: 'បង់ប្រាក់ដើម និង ការប្រាក់',
    interestBasis: 'មូលដ្ឋានការប្រាក់',
    flat: 'ការប្រាក់ថេរ',
    reducing: 'ការប្រាក់ថយតាមប្រាក់ដើម',
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
    startDate: 'កាលបរិច្ឆេទចាប់ផ្ដើម',
    notes: 'កំណត់ចំណាំ (ស្រេចចិត្ត)',
    notesPlaceholder: 'កំណត់ចំណាំ...',
    errPrincipal: 'បញ្ចូលចំនួនទឹកប្រាក់',
    errRate: 'បញ្ចូលអត្រាការប្រាក់',
    errPeriods: 'បញ្ចូលចំនួនដំណាក់',
    errDate: 'បញ្ចូលកាលបរិច្ឆេទ',
    saved: 'បានធ្វើបច្ចុប្បន្នភាព',
    scheduleWarning: 'នឹងបង្កើតកាលវិភាគថ្មីសម្រាប់ដំណាក់ដែលមិនទាន់បង់។ ដំណាក់ដែលបានបង់ហើយនឹងត្រូវបានរក្សា។ បន្ត?',
    continue: 'បន្ត',
    cancel2: 'បោះបង់',
  },
};

// ── ToggleGroup helper ────────────────────────────────────────────────────────

const ToggleGroup = ({ options, value, onChange, colors, isDark }) => {
  const { ff } = useLanguage();
  return (
    <View style={[{ flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 4 }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' }, active && { backgroundColor: isDark ? '#fff' : '#1C1C1E' }]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[{ fontSize: 13, lineHeight: 18, ...ff('600') }, { color: active ? (isDark ? '#000' : '#fff') : colors.textMuted }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

const EditLoanScreen = ({ navigation, route }) => {
  const { loan } = route.params;
  const { colors, isDark } = useTheme();
  const { language, ff, fi } = useLanguage();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);
  const scrollRef = useRef(null);

  // Existing fields
  const [currency,      setCurrency]     = useState(loan.currency ?? 'USD');
  const [rate,          setRate]         = useState(String(loan.interestRate ?? ''));
  const [periods,       setPeriods]      = useState(String(loan.totalPeriods ?? ''));
  const [notes,         setNotes]        = useState(loan.notes ?? '');

  // New fields
  const [principal,     setPrincipal]    = useState(String(loan.originalPrincipal ?? ''));
  const [repaymentType, setRepaymentType]= useState(loan.repaymentType ?? 'principal_and_interest');
  const [interestBasis, setInterestBasis]= useState(loan.interestBasis ?? 'flat');
  const [frequency,     setFrequency]    = useState(loan.frequency ?? 'monthly');
  const [scheduleMode,  setScheduleMode] = useState(loan.scheduleMode ?? 'fixed');
  const [startDate,     setStartDate]    = useState(loan.startDate ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const isFixed = scheduleMode === 'fixed';

  const validate = () => {
    const e = {};
    const p = parseFloat(principal);
    if (!principal || isNaN(p) || p <= 0) e.principal = t.errPrincipal;
    if (!rate || isNaN(parseFloat(rate)) || parseFloat(rate) < 0) e.rate = t.errRate;
    if (isFixed && (!periods || isNaN(Number(periods)) || Number(periods) < 1)) e.periods = t.errPeriods;
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.date = t.errDate;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doSave = async () => {
    setLoading(true);
    try {
      const newPrincipal = parseFloat(principal);
      const updates = {
        currency,
        originalPrincipal: newPrincipal,
        currentPrincipal:  Math.max(0, newPrincipal - (loan.totalRepaid ?? 0)),
        repaymentType,
        interestBasis,
        frequency,
        scheduleMode,
        startDate,
        interestRate: parseFloat(rate),
        notes,
        ...(isFixed ? { totalPeriods: parseInt(periods, 10) } : { totalPeriods: null }),
      };
      await editLoan(loan.id, updates, loan);
      Toast.show({ text: t.saved, type: 'success' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ text: err.message || 'Failed to update loan', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!validate()) return;

    const scheduleWillChange =
      (scheduleMode === 'fixed' || loan.scheduleMode === 'fixed') && (
        parseFloat(rate)            !== loan.interestRate    ||
        startDate                   !== loan.startDate       ||
        repaymentType               !== loan.repaymentType   ||
        interestBasis               !== loan.interestBasis   ||
        frequency                   !== loan.frequency       ||
        scheduleMode                !== loan.scheduleMode    ||
        (isFixed && parseInt(periods, 10) !== loan.totalPeriods)
      );

    if (scheduleWillChange) {
      Alert.alert(t.title, t.scheduleWarning, [
        { text: t.cancel2, style: 'cancel' },
        { text: t.continue, onPress: doSave },
      ]);
    } else {
      doSave();
    }
  };

  const inputBg    = isDark ? colors.surface : '#F2F4F8';
  const inputStyle = [styles.input, { backgroundColor: inputBg, color: colors.text }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SafeAreaView edges={['top']}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>{t.cancel}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t.title}</Text>
            <View style={{ width: 64 }} />
          </View>
        </SafeAreaView>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Currency */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.currency}</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.currencyBtn, { backgroundColor: inputBg }, currency === c && { backgroundColor: ACCENT }]}
                onPress={() => setCurrency(c)}
                activeOpacity={0.8}
              >
                <Text style={[styles.currencyText, { color: currency === c ? '#fff' : colors.text }]}>{t.currencyLabels[c] ?? c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Principal */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.principal}</Text>
          <TextInput
            style={[inputStyle, errors.principal && styles.inputError, fi()]}
            value={principal}
            onChangeText={v => { setPrincipal(v.replace(/[^0-9.]/g, '')); if (errors.principal) setErrors(e => ({ ...e, principal: null })); }}
            placeholder={t.principalPlaceholder}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
          {errors.principal ? <Text style={styles.errText}>{errors.principal}</Text> : null}

          {/* Repayment type */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.repaymentType}</Text>
          <ToggleGroup
            options={[
              { value: 'interest_only',         label: t.interestOnly },
              { value: 'principal_and_interest', label: t.principalAndInterest },
            ]}
            value={repaymentType}
            onChange={setRepaymentType}
            colors={colors}
            isDark={isDark}
          />

          {/* Interest basis */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.interestBasis}</Text>
          <ToggleGroup
            options={[
              { value: 'flat',     label: t.flat },
              { value: 'reducing', label: t.reducing },
            ]}
            value={interestBasis}
            onChange={setInterestBasis}
            colors={colors}
            isDark={isDark}
          />

          {/* Interest rate */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.rate}</Text>
          <View style={[styles.rateWrap, { backgroundColor: inputBg }, errors.rate && styles.inputError]}>
            <TextInput
              style={[styles.rateInput, { color: colors.text }, fi()]}
              value={rate}
              onChangeText={v => { setRate(v); if (errors.rate) setErrors(e => ({ ...e, rate: null })); }}
              placeholder={t.ratePlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.rateSuffix, { color: colors.textMuted }]}>%</Text>
          </View>
          {errors.rate ? <Text style={styles.errText}>{errors.rate}</Text> : null}

          {/* Frequency */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.frequency}</Text>
          <ToggleGroup
            options={[
              { value: 'weekly',  label: t.weekly },
              { value: 'monthly', label: t.monthly },
            ]}
            value={frequency}
            onChange={setFrequency}
            colors={colors}
            isDark={isDark}
          />

          {/* Schedule mode */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.schedule}</Text>
          <ToggleGroup
            options={[
              { value: 'fixed', label: t.fixed },
              { value: 'open',  label: t.open },
            ]}
            value={scheduleMode}
            onChange={setScheduleMode}
            colors={colors}
            isDark={isDark}
          />

          {/* Start date */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.startDate}</Text>
          <TouchableOpacity
            style={[inputStyle, errors.date && styles.inputError, { justifyContent: 'center' }]}
            onPress={() => { setShowDatePicker(true); if (errors.date) setErrors(e => ({ ...e, date: null })); }}
            activeOpacity={0.7}
          >
            <Text style={{ color: startDate ? colors.text : colors.textMuted, fontSize: 15 }}>
              {startDate || 'Select date'}
            </Text>
          </TouchableOpacity>
          {errors.date ? <Text style={styles.errText}>{errors.date}</Text> : null}

          {/* Periods (fixed mode only) */}
          {isFixed && (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t.periods}</Text>
              <TextInput
                style={[inputStyle, errors.periods && styles.inputError, fi()]}
                value={periods}
                onChangeText={v => { setPeriods(v.replace(/\D/g, '')); if (errors.periods) setErrors(e => ({ ...e, periods: null })); }}
                placeholder={t.periodsPlaceholder}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
              {errors.periods ? <Text style={styles.errText}>{errors.periods}</Text> : null}
            </>
          )}

          {/* Notes */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.notes}</Text>
          <TextInput
            style={[inputStyle, styles.multiline, { backgroundColor: inputBg, color: colors.text }, fi()]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notesPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)}
          />
        </ScrollView>

        <SafeAreaView
          edges={['bottom']}
          style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}
        >
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>{t.save}</Text>
            }
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <CalendarPopup
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={startDate}
        onChange={v => { setStartDate(v); setShowDatePicker(false); }}
        title={t.startDate}
        accentColor={ACCENT}
        colors={colors}
        isDark={isDark}
        language={language}
      />
    </KeyboardAvoidingView>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 64, paddingVertical: 4 },
  headerBtnText: { fontSize: 15, ...ff('500') },
  headerTitle: { fontSize: 18, ...ff('700') },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80, gap: 4 },
  label: { fontSize: 11, ...ff('700'), letterSpacing: 0, marginBottom: 8, marginTop: 12 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, ...ff('400') },
  multiline: { height: 90, paddingTop: 14, textAlignVertical: 'top' },
  inputError: { borderWidth: 1.5, borderColor: '#EF4444' },
  errText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 4 },
  currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  currencyBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: 13, ...ff('700') },
  rateWrap: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 16 },
  rateInput: { flex: 1, fontSize: 15, ...ff('400') },
  rateSuffix: { fontSize: 16, ...ff('700'), marginLeft: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: {
    height: 56, borderRadius: 16, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  saveBtnText: { color: '#fff', fontSize: 16, ...ff('700') },
});

export default EditLoanScreen;
