/**
 * TOP-UP LOAN SCREEN — Merge or New Linked Loan
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
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
import { topUpMerge, topUpNewLoan, formatCurrency } from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Toast from '../../components/Toast';

const ACCENT = '#00C2B2';

const T = {
  en: {
    title: 'Top-Up Loan',
    cancel: 'Cancel',
    amount: 'TOP-UP AMOUNT',
    amountPlaceholder: '0',
    method: 'TOP-UP METHOD',
    merge: 'Merge into this loan',
    mergeDesc: 'Adds to outstanding balance, regenerates schedule',
    newLoan: 'New linked loan',
    newLoanDesc: 'Creates separate loan linked to this borrower',
    notes: 'NOTES (optional)',
    notesPlaceholder: 'Reason for top-up...',
    save: 'Apply Top-Up',
    errAmount: 'Enter a valid amount',
    successMerge: 'Loan topped up successfully',
    successNew: 'New linked loan created',
    currentBalance: 'Current Outstanding',
    newBalance: 'New Balance (after merge)',
  },
  km: {
    title: 'បន្ថែមប្រាក់កម្ចី',
    cancel: 'បោះបង់',
    amount: 'ចំនួនបន្ថែម',
    amountPlaceholder: '0',
    method: 'វិធីសាស្ត្របន្ថែម',
    merge: 'បញ្ចូលទៅក្នុងប្រាក់កម្ចីនេះ',
    mergeDesc: 'បន្ថែមទៅប្រាក់ជំពាក់ ចំណាំ: ការបង្កើតកាលវិភាគឡើងវិញ',
    newLoan: 'ប្រាក់កម្ចីថ្មីដែលភ្ជាប់',
    newLoanDesc: 'បង្កើតប្រាក់កម្ចីដាច់ដោយឡែករបស់អតិថិជនដូចគ្នា',
    notes: 'កំណត់ចំណាំ',
    notesPlaceholder: 'មូលហេតុ...',
    save: 'អនុវត្ត',
    errAmount: 'បញ្ចូលចំនួន',
    successMerge: 'បានបន្ថែមប្រាក់កម្ចីដោយជោគជ័យ',
    successNew: 'បានបង្កើតប្រាក់កម្ចីថ្មីដោយជោគជ័យ',
    currentBalance: 'ប្រាក់ជំពាក់បច្ចុប្បន្ន',
    newBalance: 'ប្រាក់ជំពាក់ថ្មី (បន្ទាប់ពីបញ្ចូល)',
  },
};

const TopUpLoanScreen = ({ navigation, route }) => {
  const { loan } = route.params;
  const { colors, isDark } = useTheme();
  const { language, ff, fi } = useLanguage();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);
  const scrollRef = useRef(null);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('merge');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputBg = isDark ? colors.surface : '#F2F4F8';
  const rawAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const newBalance = loan.currentPrincipal + rawAmount;

  const handleSave = async () => {
    if (!rawAmount || rawAmount <= 0) { setError(t.errAmount); return; }
    setError('');
    setLoading(true);
    try {
      if (method === 'merge') {
        await topUpMerge(loan.id, rawAmount, notes);
        Toast.show({ text: t.successMerge, type: 'success' });
      } else {
        await topUpNewLoan(loan, rawAmount, notes);
        Toast.show({ text: t.successNew, type: 'success' });
      }
      navigation.goBack();
    } catch (err) {
      Toast.show({ text: err.message || 'Top-up failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

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
          {/* Current balance */}
          <View style={[styles.balanceCard, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '25' }]}>
            <View>
              <Text style={[styles.balanceLabel, { color: ACCENT }]}>{t.currentBalance}</Text>
              <Text style={[styles.balanceValue, { color: ACCENT }]}>{formatCurrency(loan.currentPrincipal, loan.currency)}</Text>
            </View>
            {rawAmount > 0 && method === 'merge' && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>{t.newBalance}</Text>
                <Text style={[styles.balanceValue, { color: '#10B981' }]}>{formatCurrency(newBalance, loan.currency)}</Text>
              </View>
            )}
          </View>

          {/* Amount */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.amount}</Text>
          <View style={[styles.amountWrap, { backgroundColor: inputBg }, error && styles.inputError]}>
            <Text style={[styles.currencySymbol, { color: colors.textMuted }]}>{loan.currency}</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }, fi()]}
              value={amount ? parseInt(amount.replace(/,/g, ''), 10).toLocaleString() : ''}
              onChangeText={v => {
                const raw = v.replace(/,/g, '');
                if (raw === '' || /^\d+$/.test(raw)) { setAmount(raw); setError(''); }
              }}
              placeholder={t.amountPlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              autoFocus
            />
          </View>
          {error ? <Text style={styles.errText}>{error}</Text> : null}

          {/* Method */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.method}</Text>

          <TouchableOpacity
            style={[styles.methodCard, { backgroundColor: isDark ? colors.surface : '#fff' }, method === 'merge' && styles.methodCardActive]}
            onPress={() => setMethod('merge')}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, method === 'merge' && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
              {method === 'merge' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodTitle, { color: colors.text }]}>{t.merge}</Text>
              <Text style={[styles.methodDesc, { color: colors.textMuted }]}>{t.mergeDesc}</Text>
            </View>
            <Ionicons name="git-merge-outline" size={22} color={method === 'merge' ? ACCENT : colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodCard, { backgroundColor: isDark ? colors.surface : '#fff', marginTop: 8 }, method === 'new_loan' && styles.methodCardActive]}
            onPress={() => setMethod('new_loan')}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, method === 'new_loan' && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
              {method === 'new_loan' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodTitle, { color: colors.text }]}>{t.newLoan}</Text>
              <Text style={[styles.methodDesc, { color: colors.textMuted }]}>{t.newLoanDesc}</Text>
            </View>
            <Ionicons name="add-circle-outline" size={22} color={method === 'new_loan' ? ACCENT : colors.textMuted} />
          </TouchableOpacity>

          {/* Notes */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.notes}</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: inputBg, color: colors.text }, fi()]}
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
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 80 },
  balanceCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 8 },
  balanceLabel: { fontSize: 12, ...ff('600'), marginBottom: 4 },
  balanceValue: { fontSize: 18, ...ff('800') },
  label: { fontSize: 11, ...ff('700'), letterSpacing: 0, marginBottom: 8, marginTop: 16 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 14, paddingHorizontal: 16 },
  currencySymbol: { fontSize: 15, ...ff('600'), marginRight: 8 },
  amountInput: { flex: 1, fontSize: 22, ...ff('700') },
  inputError: { borderWidth: 1.5, borderColor: '#EF4444' },
  errText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 4 },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: 'transparent',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  methodCardActive: { borderColor: ACCENT },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  methodTitle: { fontSize: 14, ...ff('400'), marginBottom: 2 },
  methodDesc: { fontSize: 12 },
  notesInput: { borderRadius: 14, padding: 14, fontSize: 15, height: 80, textAlignVertical: 'top' },
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

export default TopUpLoanScreen;
