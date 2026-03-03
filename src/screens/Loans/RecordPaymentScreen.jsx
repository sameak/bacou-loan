/**
 * RECORD PAYMENT SCREEN — Fixed mode + Open-ended mode
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import {
  getSchedule,
  recordPayment,
  calcAccruedInterest,
  today,
  formatCurrency,
} from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Toast from '../../components/Toast';
import CalendarPopup from '../../components/CalendarPopup';

const ACCENT = '#6366F1';

const T = {
  en: {
    title: 'Record Payment',
    cancel: 'Cancel',
    save: 'Record',
    period: 'PERIOD',
    selectPeriod: 'Select period (optional)',
    principalPaid: 'PRINCIPAL AMOUNT',
    interestPaid: 'INTEREST AMOUNT',
    date: 'PAYMENT DATE',
    notes: 'NOTES (optional)',
    notesPlaceholder: 'Payment notes...',
    accruedInfo: (days, amount, currency) => `Accrued over ${days} days: ${formatCurrency(amount, currency)}`,
    errDate: 'Enter date',
    saved: 'Payment recorded',
    outstanding: 'Outstanding',
    dueThisPeriod: 'Due this period',
    noPeriods: 'No upcoming periods',
    totalPayment: 'Total Payment',
  },
  km: {
    title: 'កត់ត្រាការបង់',
    cancel: 'បោះបង់',
    save: 'កត់ត្រា',
    period: 'ដំណាក់',
    selectPeriod: 'ជ្រើសដំណាក់ (ស្រេចចិត្ត)',
    principalPaid: 'ប្រាក់ដើម',
    interestPaid: 'ការប្រាក់',
    date: 'កាលបរិច្ឆេទ',
    notes: 'កំណត់ចំណាំ (ស្រេចចិត្ត)',
    notesPlaceholder: 'កំណត់ចំណាំ...',
    accruedInfo: (days, amount, currency) => `ប្រូងក្នុង ${days} ថ្ងៃ: ${formatCurrency(amount, currency)}`,
    errDate: 'បញ្ចូលកាលបរិច្ឆេទ',
    saved: 'បានកត់ត្រាការបង់',
    outstanding: 'នៅជំពាក់',
    dueThisPeriod: 'ត្រូវបង់',
    noPeriods: 'គ្មានដំណាក់',
    totalPayment: 'សរុបការបង់',
  },
};

const formatNum = (raw) => {
  const n = Number(raw || 0);
  return isNaN(n) ? '0' : n.toLocaleString();
};

const RecordPaymentScreen = ({ navigation, route }) => {
  const { loan } = route.params;
  const { colors, isDark } = useTheme();
  const { language, ff, fi } = useLanguage();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);
  const scrollRef = useRef(null);

  const isOpen = loan.scheduleMode === 'open';
  const isInterestOnly = loan.repaymentType === 'interest_only';

  const [schedule, setSchedule] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const [principalRaw, setPrincipalRaw] = useState('0');
  const [interestRaw, setInterestRaw] = useState('0');
  const [paymentDate, setPaymentDate] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Open mode: auto-calculate accrued interest on date change
  const accruedDays = useMemo(() => {
    if (!isOpen) return 0;
    const from = loan.lastPaymentDate ?? loan.startDate;
    const to = paymentDate;
    if (!to.match(/^\d{4}-\d{2}-\d{2}$/)) return 0;
    const diffMs = new Date(to) - new Date(from);
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }, [isOpen, paymentDate, loan]);

  const accruedInterest = useMemo(() => {
    if (!isOpen) return 0;
    return calcAccruedInterest(loan, paymentDate.match(/^\d{4}-\d{2}-\d{2}$/) ? paymentDate : today());
  }, [isOpen, loan, paymentDate]);

  // Auto-fill interest for open mode
  useEffect(() => {
    if (isOpen) {
      setInterestRaw(String(accruedInterest));
    }
  }, [accruedInterest, isOpen]);

  // Fetch schedule for fixed mode
  useEffect(() => {
    if (!isOpen) {
      getSchedule(loan.id).then(data => {
        const unpaid = data.filter(p => p.status !== 'paid');
        setSchedule(unpaid);
        // Auto-select first upcoming/overdue period
        if (unpaid.length > 0) {
          setSelectedPeriod(unpaid[0]);
          if (!isInterestOnly) {
            setPrincipalRaw(String(unpaid[0].principalDue ?? 0));
          }
          setInterestRaw(String(unpaid[0].interestDue ?? 0));
        }
      });
    }
  }, [isOpen, loan.id, isInterestOnly]);

  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
    setShowPeriodPicker(false);
    if (!isInterestOnly) setPrincipalRaw(String(period.principalDue ?? 0));
    setInterestRaw(String(period.interestDue ?? 0));
  };

  const validate = () => {
    const e = {};
    if (!paymentDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.date = t.errDate;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await recordPayment(loan.id, {
        principalAmount: parseFloat(principalRaw) || 0,
        interestAmount: parseFloat(interestRaw) || 0,
        date: paymentDate,
        daysAccrued: isOpen ? accruedDays : null,
        schedulePeriodId: selectedPeriod?.id ?? null,
        notes,
      });
      Toast.show({ text: t.saved, type: 'success' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ text: err.message || 'Failed to record payment', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const inputBg = isDark ? colors.surface : '#F2F4F8';
  const inputStyle = [styles.input, { backgroundColor: inputBg, color: colors.text }];

  const numInput = (raw, setRaw, placeholder = '0') => (
    <TextInput
      style={[inputStyle, fi()]}
      value={raw ? parseInt(String(raw).replace(/,/g, ''), 10).toLocaleString() : ''}
      onChangeText={v => {
        const r = v.replace(/,/g, '');
        if (r === '' || /^\d*\.?\d*$/.test(r)) setRaw(r);
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType="decimal-pad"
    />
  );

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

        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Outstanding summary */}
          <View style={[styles.summaryCard, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '25' }]}>
            <Text style={[styles.summaryLabel, { color: ACCENT }]}>{t.outstanding}</Text>
            <Text style={[styles.summaryValue, { color: ACCENT }]}>
              {formatCurrency(loan.currentPrincipal, loan.currency)}
            </Text>
          </View>

          {/* Open mode: accrual info */}
          {isOpen && accruedDays > 0 && (
            <View style={[styles.accrualInfo, { backgroundColor: '#F59E0B' + '15' }]}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={styles.accrualText}>{t.accruedInfo(accruedDays, accruedInterest, loan.currency)}</Text>
            </View>
          )}

          {/* Fixed mode: period picker */}
          {!isOpen && (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t.period}</Text>
              <TouchableOpacity
                style={[styles.pickerRow, { backgroundColor: inputBg }]}
                onPress={() => setShowPeriodPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickerText, { color: selectedPeriod ? colors.text : colors.textMuted }]}>
                  {selectedPeriod
                    ? `Period ${selectedPeriod.periodNumber} — due ${selectedPeriod.dueDate} (${formatCurrency(selectedPeriod.totalDue - (selectedPeriod.paidAmount ?? 0), loan.currency)})`
                    : t.selectPeriod}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          {/* Principal paid */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.principalPaid}</Text>
          {isInterestOnly
            ? <View style={[styles.readonlyRow, { backgroundColor: inputBg }]}><Text style={[styles.readonlyText, { color: colors.textMuted }]}>0 (Interest-only loan)</Text></View>
            : numInput(principalRaw, setPrincipalRaw)
          }

          {/* Interest paid */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.interestPaid}</Text>
          {numInput(interestRaw, setInterestRaw)}

          {/* Date */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.date}</Text>
          <TouchableOpacity
            style={[inputStyle, errors.date && styles.inputError, { justifyContent: 'center' }]}
            onPress={() => { setShowDatePicker(true); if (errors.date) setErrors(e => ({ ...e, date: null })); }}
            activeOpacity={0.7}
          >
            <Text style={{ color: paymentDate ? colors.text : colors.textMuted, fontSize: 15 }}>
              {paymentDate || 'Select date'}
            </Text>
          </TouchableOpacity>
          {errors.date ? <Text style={styles.errText}>{errors.date}</Text> : null}

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

          {/* Total */}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t.totalPayment}</Text>
            <Text style={[styles.totalValue, { color: '#10B981' }]}>
              {formatCurrency((parseFloat(principalRaw) || 0) + (parseFloat(interestRaw) || 0), loan.currency)}
            </Text>
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t.save}</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Date picker */}
      <CalendarPopup
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={paymentDate}
        onChange={v => setPaymentDate(v)}
        title={t.date}
        accentColor={ACCENT}
        colors={colors}
        isDark={isDark}
        language={language}
      />

      {/* Period picker modal */}
      <Modal visible={showPeriodPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPeriodPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.pickerHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t.period}</Text>
            {schedule.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t.noPeriods}</Text>
            ) : (
              <FlatList
                data={schedule}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.periodRow,
                      index < schedule.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      item.status === 'overdue' && { backgroundColor: 'rgba(239,68,68,0.06)' },
                      selectedPeriod?.id === item.id && { backgroundColor: ACCENT + '10' },
                    ]}
                    onPress={() => handlePeriodSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.periodInfo}>
                      <Text style={[styles.periodNum, { color: colors.text }]}>Period {item.periodNumber}</Text>
                      <Text style={[styles.periodDate, { color: item.status === 'overdue' ? '#EF4444' : colors.textMuted }]}>
                        Due: {item.dueDate} {item.status === 'overdue' ? '⚠' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.periodAmount, { color: colors.text }]}>
                      {formatCurrency(item.totalDue - (item.paidAmount ?? 0), loan.currency)}
                    </Text>
                    {selectedPeriod?.id === item.id && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 64 },
  headerBtnText: { fontSize: 15, ...ff('500') },
  headerTitle: { fontSize: 18, ...ff('700') },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 80, gap: 4 },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, ...ff('600') },
  summaryValue: { fontSize: 18, ...ff('800') },
  accrualInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  accrualText: { fontSize: 13, color: '#F59E0B', ...ff('500'), flex: 1 },
  label: { fontSize: 11, ...ff('700'), letterSpacing: 0, marginBottom: 8, marginTop: 12 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 15 },
  multiline: { height: 80, paddingTop: 14 },
  inputError: { borderWidth: 1.5, borderColor: '#EF4444' },
  errText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 4 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 16 },
  pickerText: { flex: 1, fontSize: 14, ...ff('400') },
  readonlyRow: { height: 52, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' },
  readonlyText: { fontSize: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, marginTop: 8 },
  totalLabel: { fontSize: 14, ...ff('600') },
  totalValue: { fontSize: 18, ...ff('800') },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', paddingBottom: 24 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  modalTitle: { fontSize: 16, ...ff('700'), paddingHorizontal: 20, paddingBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  periodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  periodInfo: { flex: 1 },
  periodNum: { fontSize: 15, ...ff('600'), marginBottom: 2 },
  periodDate: { fontSize: 13 },
  periodAmount: { fontSize: 15, ...ff('700') },
});

export default RecordPaymentScreen;
