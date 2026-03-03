/**
 * EDIT LOAN SCREEN
 * Editable fields: currency, interestRate, totalPeriods (fixed mode), notes
 * If interestRate or totalPeriods change on a fixed loan, the unpaid schedule
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

const ACCENT = '#6366F1';
const CURRENCIES = ['USD', 'KHR', 'KRW', 'Other'];

const T = {
  en: {
    title: 'Edit Loan',
    cancel: 'Cancel',
    save: 'Save Changes',
    currency: 'CURRENCY',
    rate: 'INTEREST RATE (% per period)',
    ratePlaceholder: '3',
    periods: 'NUMBER OF PERIODS',
    periodsPlaceholder: '12',
    notes: 'NOTES (optional)',
    notesPlaceholder: 'Any notes about this loan...',
    errRate: 'Enter a valid interest rate',
    errPeriods: 'Enter a valid number of periods',
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
    rate: 'អត្រាការប្រាក់ (% ក្នុងដំណាក់)',
    ratePlaceholder: '3',
    periods: 'ចំនួនដំណាក់',
    periodsPlaceholder: '12',
    notes: 'កំណត់ចំណាំ (ស្រេចចិត្ត)',
    notesPlaceholder: 'កំណត់ចំណាំ...',
    errRate: 'បញ្ចូលអត្រាការប្រាក់',
    errPeriods: 'បញ្ចូលចំនួនដំណាក់',
    saved: 'បានធ្វើបច្ចុប្បន្នភាព',
    scheduleWarning: 'នឹងបង្កើតកាលវិភាគថ្មីសម្រាប់ដំណាក់ដែលមិនទាន់បង់។ ដំណាក់ដែលបានបង់ហើយនឹងត្រូវបានរក្សា។ បន្ត?',
    continue: 'បន្ត',
    cancel2: 'បោះបង់',
  },
};

const EditLoanScreen = ({ navigation, route }) => {
  const { loan } = route.params;
  const { colors, isDark } = useTheme();
  const { language, ff, fi } = useLanguage();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);
  const scrollRef = useRef(null);

  const isFixed = loan.scheduleMode === 'fixed';

  const [currency, setCurrency] = useState(loan.currency ?? 'USD');
  const [rate, setRate] = useState(String(loan.interestRate ?? ''));
  const [periods, setPeriods] = useState(String(loan.totalPeriods ?? ''));
  const [notes, setNotes] = useState(loan.notes ?? '');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!rate || isNaN(parseFloat(rate)) || parseFloat(rate) < 0) e.rate = t.errRate;
    if (isFixed && (!periods || isNaN(Number(periods)) || Number(periods) < 1)) e.periods = t.errPeriods;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doSave = async () => {
    setLoading(true);
    try {
      const updates = {
        currency,
        interestRate: parseFloat(rate),
        notes,
        ...(isFixed ? { totalPeriods: parseInt(periods, 10) } : {}),
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
      isFixed &&
      (parseFloat(rate) !== loan.interestRate || parseInt(periods, 10) !== loan.totalPeriods);

    if (scheduleWillChange) {
      Alert.alert(t.title, t.scheduleWarning, [
        { text: t.cancel2, style: 'cancel' },
        { text: t.continue, onPress: doSave },
      ]);
    } else {
      doSave();
    }
  };

  const inputBg = isDark ? colors.surface : '#F2F4F8';
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
                <Text style={[styles.currencyText, { color: currency === c ? '#fff' : colors.text }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
