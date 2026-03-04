/**
 * CREATE LOAN SCREEN — Full form with all toggles
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBorrowers } from '../../services/borrowerService';
import { createLoan, today } from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Toast from '../../components/Toast';
import CalendarPopup from '../../components/CalendarPopup';

const ACCENT = '#00C2B2';
const CURRENCIES = ['USD', 'KHR', 'KRW', 'Other'];
const CURRENCY_LABELS = {
  km: { USD: 'ប្រាក់ដុល្លា', KHR: 'ប្រាក់រៀល', KRW: 'ប្រាក់វ៉ុន', Other: 'ផ្សេងៗ' },
};

const T = {
  en: {
    title: 'New Loan',
    cancel: 'Cancel',
    save: 'Create Loan',
    friendlyLoan: 'Friendly Loan',
    friendlyLoanHint: '0% interest · Pay anytime',
    borrower: 'BORROWER',
    selectBorrower: 'Select borrower...',
    currency: 'CURRENCY',
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
    errBorrower: 'Select a borrower',
    errPrincipal: 'Enter principal amount',
    errRate: 'Enter interest rate',
    errPeriods: 'Enter number of periods',
    errDate: 'Enter start date',
    created: 'Loan created successfully',
    searchBorrower: 'Search borrowers...',
    addBorrower: '+ Add new borrower',
  },
  km: {
    title: 'ប្រាក់កម្ចីថ្មី',
    cancel: 'បោះបង់',
    save: 'បង្កើតប្រាក់កម្ចី',
    friendlyLoan: 'ប្រាក់កម្ចីអត់ការប្រាក់',
    friendlyLoanHint: '0% · បង់ពេលណាក៏បាន',
    borrower: 'អតិថិជន',
    selectBorrower: 'ជ្រើសរើសអតិថិជន...',
    currency: 'រូបិយប័ណ្ណ',
    principal: 'ចំនួនទឹកប្រាក់',
    principalPlaceholder: '0',
    repaymentType: 'ប្រភេទការបង់',
    interestOnly: 'បង់តែការប្រាក់',
    principalAndInterest: 'បង់ប្រាក់ដើម និង ការប្រាក់',
    interestBasis: 'មូលដ្ឋានការប្រាក់',
    flat: 'ការប្រាក់ថេរ',
    reducing: 'ការប្រាក់ថយចុះ',
    rate: 'អត្រាការប្រាក់',
    ratePlaceholder: '3',
    frequency: 'រយៈពេលបង់',
    weekly: 'ប្រចាំសប្ដាហ៍',
    monthly: 'ប្រចាំខែ',
    schedule: 'កាលវិភាគបង់ប្រាក់',
    fixed: 'បង់តាមកាលកំណត់',
    open: 'មិនកំណត់ពេល',
    periods: 'ចំនួនដំណាក់កាល',
    periodsPlaceholder: '12',
    startDate: 'កាលបរិច្ឆេទចាប់ផ្ដើមបង់ប្រាក់',
    notes: 'កំណត់ចំណាំ',
    notesPlaceholder: 'កំណត់ចំណាំ...',
    errBorrower: 'ជ្រើសរើសអតិថិជន',
    errPrincipal: 'បញ្ចូលចំនួនទឹកប្រាក់',
    errRate: 'បញ្ចូលអត្រាការប្រាក់',
    errPeriods: 'បញ្ចូលចំនួនដំណាក់កាល',
    errDate: 'បញ្ចូលកាលបរិច្ឆេទ',
    created: 'បានបង្កើតប្រាក់កម្ចីដោយជោគជ័យ',
    searchBorrower: 'ស្វែងរកអតិថិជន...',
    addBorrower: '+ បន្ថែមអតិថិជនថ្មី',
  },
};

const ToggleGroup = ({ options, value, onChange, colors, isDark }) => {
  const { ff, fs } = useLanguage();
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
            <Text style={[{ fontSize: fs(13), lineHeight: 18, letterSpacing: 0, ...ff('600') }, { color: active ? (isDark ? '#000' : '#fff') : colors.textMuted }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const CreateLoanScreen = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { language, ff, fi, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff, fs), [ff, fs]);
  const scrollRef = useRef(null);

  // Pre-fill from BorrowerDetail or DashboardScreen FAB
  const prefillBorrowerId = route?.params?.prefillBorrowerId;
  const prefillBorrowerName = route?.params?.prefillBorrowerName;

  const [borrowers, setBorrowers] = useState([]);
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [showBorrowerPicker, setShowBorrowerPicker] = useState(false);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState(prefillBorrowerId ?? '');
  const [selectedBorrowerName, setSelectedBorrowerName] = useState(prefillBorrowerName ?? '');

  const [currency, setCurrency] = useState('USD');
  const [principal, setPrincipal] = useState('');
  const [repaymentType, setRepaymentType] = useState('interest_only');
  const [interestBasis, setInterestBasis] = useState('flat');
  const [rate, setRate] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [scheduleMode, setScheduleMode] = useState('fixed');
  const [periods, setPeriods] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBorrowers().then(setBorrowers);
  }, []);

  const filteredBorrowers = borrowers.filter(b =>
    !borrowerSearch || b.name.toLowerCase().includes(borrowerSearch.toLowerCase()) || b.phone.includes(borrowerSearch)
  );

  const validate = () => {
    const e = {};
    if (!selectedBorrowerId) e.borrower = t.errBorrower;
    if (!principal || isNaN(Number(principal.replace(/,/g, '')))) e.principal = t.errPrincipal;
    if (!rate || isNaN(parseFloat(rate))) e.rate = t.errRate;
    if (scheduleMode === 'fixed' && (!periods || isNaN(Number(periods)))) e.periods = t.errPeriods;
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.startDate = t.errDate;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const rawPrincipal = Number(principal.replace(/,/g, ''));
      const loanId = await createLoan({
        borrowerId: selectedBorrowerId,
        borrowerName: selectedBorrowerName,
        currency,
        originalPrincipal: rawPrincipal,
        interestRate: parseFloat(rate),
        interestBasis,
        repaymentType,
        frequency,
        scheduleMode,
        totalPeriods: scheduleMode === 'fixed' ? parseInt(periods, 10) : null,
        startDate,
        notes,
      });
      Toast.show({ text: t.created, type: 'success' });
      navigation.goBack();
      // Navigate to the new loan detail
      setTimeout(() => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanDetail', params: { loanId } } }), 300);
    } catch (err) {
      Toast.show({ text: err.message || 'Failed to create loan', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const applyFriendlyLoan = () => {
    setRate('0');
    setScheduleMode('open');
    setRepaymentType('principal_and_interest');
    setErrors({});
  };

  const inputBg = isDark ? colors.surface : '#F2F4F8';
  const inputStyle = [styles.input, { backgroundColor: inputBg, color: colors.text }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <SafeAreaView edges={['top']}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>{t.cancel}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t.title}</Text>
            <View style={{ width: 64 }} />
          </View>
        </SafeAreaView>

        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Friendly Loan preset */}
          <TouchableOpacity
            onPress={applyFriendlyLoan}
            activeOpacity={0.8}
            style={[styles.presetChip, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}
          >
            <Text style={styles.presetIcon}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.presetTitle, { color: '#10B981' }]}>{t.friendlyLoan}</Text>
              <Text style={[styles.presetHint, { color: '#10B981' }]}>{t.friendlyLoanHint}</Text>
            </View>
            <Ionicons name="flash" size={16} color="#10B981" />
          </TouchableOpacity>

          {/* Borrower picker */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.borrower}</Text>
          <TouchableOpacity
            style={[styles.pickerRow, { backgroundColor: inputBg }, errors.borrower && styles.inputError]}
            onPress={() => setShowBorrowerPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pickerText, { color: selectedBorrowerId ? colors.text : colors.textMuted }]}>
              {selectedBorrowerId ? selectedBorrowerName : t.selectBorrower}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {errors.borrower ? <Text style={styles.errText}>{errors.borrower}</Text> : null}

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
                <Text style={[styles.currencyText, { color: currency === c ? '#fff' : colors.text }]}>{(CURRENCY_LABELS[language] || {})[c] || c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Principal */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.principal}</Text>
          <TextInput
            style={[inputStyle, errors.principal && styles.inputError, fi()]}
            value={principal ? parseInt(principal.replace(/,/g, ''), 10).toLocaleString() : ''}
            onChangeText={v => {
              const raw = v.replace(/,/g, '');
              if (raw === '' || /^\d+$/.test(raw)) {
                setPrincipal(raw);
                if (errors.principal) setErrors(e => ({ ...e, principal: null }));
              }
            }}
            placeholder={t.principalPlaceholder}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          {errors.principal ? <Text style={styles.errText}>{errors.principal}</Text> : null}

          {/* Repayment type */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.repaymentType}</Text>
          <ToggleGroup
            options={[{ value: 'interest_only', label: t.interestOnly }, { value: 'principal_and_interest', label: t.principalAndInterest }]}
            value={repaymentType}
            onChange={setRepaymentType}
            colors={colors}
            isDark={isDark}
          />

          {/* Interest basis */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.interestBasis}</Text>
          <ToggleGroup
            options={[{ value: 'flat', label: t.flat }, { value: 'reducing', label: t.reducing }]}
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
            options={[{ value: 'weekly', label: t.weekly }, { value: 'monthly', label: t.monthly }]}
            value={frequency}
            onChange={setFrequency}
            colors={colors}
            isDark={isDark}
          />

          {/* Schedule mode */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.schedule}</Text>
          <ToggleGroup
            options={[{ value: 'fixed', label: t.fixed }, { value: 'open', label: t.open }]}
            value={scheduleMode}
            onChange={setScheduleMode}
            colors={colors}
            isDark={isDark}
          />

          {/* Periods (fixed only) */}
          {scheduleMode === 'fixed' && (
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

          {/* Start date */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.startDate}</Text>
          <TouchableOpacity
            style={[inputStyle, errors.startDate && styles.inputError, { justifyContent: 'center' }]}
            onPress={() => { setShowDatePicker(true); if (errors.startDate) setErrors(e => ({ ...e, startDate: null })); }}
            activeOpacity={0.7}
          >
            <Text style={{ color: startDate ? colors.text : colors.textMuted, fontSize: fs(15), letterSpacing: 0 }}>
              {startDate || 'Select date'}
            </Text>
          </TouchableOpacity>
          {errors.startDate ? <Text style={styles.errText}>{errors.startDate}</Text> : null}

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

        {/* Save button */}
        <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
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

      {/* Date picker */}
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

      {/* Borrower picker modal */}
      <Modal visible={showBorrowerPicker} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowBorrowerPicker(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.pickerHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            <View style={[styles.pickerSearchWrap, { backgroundColor: isDark ? colors.background : '#F2F4F8', borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.pickerSearch, { color: colors.text }, fi()]}
                value={borrowerSearch}
                onChangeText={setBorrowerSearch}
                placeholder={t.searchBorrower}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.addBorrowerRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowBorrowerPicker(false);
                  navigation.navigate('CreateBorrower', {
                    onCreated: (b) => {
                      setBorrowers(prev => [...prev, b].sort((a, c) => a.name.localeCompare(c.name)));
                      setSelectedBorrowerId(b.id);
                      setSelectedBorrowerName(b.name);
                    },
                  });
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
                <Text style={[styles.addBorrowerText, { color: ACCENT }]}>{t.addBorrower}</Text>
              </TouchableOpacity>
              {filteredBorrowers.map((b, i) => (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.borrowerRow,
                    i < filteredBorrowers.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    b.id === selectedBorrowerId && { backgroundColor: ACCENT + '10' },
                  ]}
                  onPress={() => {
                    setSelectedBorrowerId(b.id);
                    setSelectedBorrowerName(b.name);
                    setBorrowerSearch('');
                    setShowBorrowerPicker(false);
                    if (errors.borrower) setErrors(e => ({ ...e, borrower: null }));
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.borrowerAvatar, { backgroundColor: ACCENT + '20' }]}>
                    <Text style={[styles.borrowerAvatarText, { color: ACCENT }]}>{b.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.borrowerName, { color: colors.text }]}>{b.name}</Text>
                    <Text style={[styles.borrowerPhone, { color: colors.textMuted }]}>{b.phone}</Text>
                  </View>
                  {b.id === selectedBorrowerId && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (ff, fs) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 64, paddingVertical: 4 },
  headerBtnText: { fontSize: fs(15), lineHeight: 20, letterSpacing: 0, ...ff('500') },
  headerTitle: { fontSize: fs(18), lineHeight: 29, letterSpacing: 0, ...ff('700') },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80, gap: 8 },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
  },
  presetIcon: { fontSize: 22 },
  presetTitle: { fontSize: fs(14), lineHeight: 25, letterSpacing: 0, ...ff('700'), marginBottom: 1 },
  presetHint: { fontSize: fs(12), lineHeight: 22, letterSpacing: 0, opacity: 0.8 },
  label: { fontSize: fs(11), lineHeight: 21, letterSpacing: 0, ...ff('700'), marginBottom: 4, marginTop: 24 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: fs(15), letterSpacing: 0, ...ff('400') },
  multiline: { height: 90, paddingTop: 14, textAlignVertical: 'top' },
  inputError: { borderWidth: 1.5, borderColor: '#EF4444' },
  errText: { fontSize: fs(12), lineHeight: 16, letterSpacing: 0, color: '#EF4444', marginTop: 4, marginLeft: 4 },
  currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  currencyBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0, ...ff('700') },
  rateWrap: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 16 },
  rateInput: { flex: 1, fontSize: fs(15), letterSpacing: 0, ...ff('400') },
  rateSuffix: { fontSize: fs(16), lineHeight: 21, letterSpacing: 0, ...ff('700'), marginLeft: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 16 },
  pickerText: { flex: 1, fontSize: fs(15), letterSpacing: 0, ...ff('400') },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: {
    height: 56, borderRadius: 16, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: fs(16), lineHeight: 21, letterSpacing: 0, ...ff('700') },
  // Borrower picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 24 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 12 },
  pickerSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12,
    height: 42, borderRadius: 12, borderWidth: 1,
  },
  pickerSearch: { flex: 1, fontSize: fs(15), letterSpacing: 0 },
  addBorrowerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addBorrowerText: { fontSize: fs(15), lineHeight: 20, letterSpacing: 0, ...ff('600') },
  borrowerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  borrowerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  borrowerAvatarText: { fontSize: fs(16), lineHeight: 21, letterSpacing: 0, ...ff('700') },
  borrowerName: { fontSize: fs(15), lineHeight: 20, letterSpacing: 0, ...ff('500'), marginBottom: 1 },
  borrowerPhone: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },
});

export default CreateLoanScreen;
