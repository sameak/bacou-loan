/**
 * BORROWER DETAIL SCREEN
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { updateBorrower, deleteBorrower } from '../../services/borrowerService';
import { listenLoansByBorrower, getLoansByBorrower, deleteLoan, formatCurrency } from '../../services/loanService';
import { listenBorrowers } from '../../services/borrowerService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';

const ACCENT = '#6366F1';

const STATUS_COLORS = { active: '#10B981', overdue: '#EF4444', paid: '#9CA3AF' };

const T = {
  en: {
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    newLoan: 'New Loan',
    activeLoans: 'Active Loans',
    overdueLoans: 'Overdue',
    paidLoans: 'Paid Loans',
    noLoans: 'No loans yet',
    noLoansHint: 'Create a loan for this borrower',
    principal: 'Outstanding',
    rate: 'Rate',
    status: { active: 'Active', overdue: 'Overdue', paid: 'Paid' },
    saved: 'Borrower updated',
    deleteBorrower: 'Delete Borrower',
    confirmDelete: 'Delete this borrower and ALL their loans? This cannot be undone.',
    confirmDeleteYes: 'Delete',
    deleted: 'Borrower deleted',
  },
  km: {
    edit: 'កែប្រែ',
    save: 'រក្សាទុក',
    cancel: 'បោះបង់',
    newLoan: 'ប្រាក់កម្ចីថ្មី',
    activeLoans: 'ប្រាក់កម្ចីដំណើរការ',
    overdueLoans: 'ហួសកំណត់',
    paidLoans: 'បានបង់រួច',
    noLoans: 'មិនទាន់មានប្រាក់កម្ចី',
    noLoansHint: 'បង្កើតប្រាក់កម្ចីសម្រាប់អ្នកខ្ចីនេះ',
    principal: 'នៅជំពាក់',
    rate: 'អត្រា',
    status: { active: 'ដំណើរការ', overdue: 'ហួសកំណត់', paid: 'បានបង់' },
    saved: 'បានកែប្រែ',
    deleteBorrower: 'លុបអ្នកខ្ចី',
    confirmDelete: 'លុបអ្នកខ្ចីនេះ និងប្រាក់កម្ចីទាំងអស់? មិនអាចមិនធ្វើវិញបានទេ។',
    confirmDeleteYes: 'លុប',
    deleted: 'បានលុបអ្នកខ្ចី',
  },
};

const BorrowerDetailScreen = ({ navigation, route }) => {
  const { borrowerId } = route.params;
  const { colors, isDark } = useTheme();
  const { language, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs), [fs]);

  const [borrower, setBorrower] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = listenBorrowers(all => {
      const found = all.find(b => b.id === borrowerId);
      if (found) {
        setBorrower(found);
        setEditName(found.name);
        setEditPhone(found.phone);
        setEditAddress(found.address ?? '');
      }
    });
    return unsub;
  }, [borrowerId]);

  useEffect(() => {
    const unsub = listenLoansByBorrower(borrowerId, data => {
      setLoans(data); // already sorted newest-first
      setLoadingLoans(false);
    });
    return unsub;
  }, [borrowerId]);

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateBorrower(borrowerId, { name: editName.trim(), phone: editPhone.trim(), address: editAddress.trim() });
      Toast.show({ text: t.saved, type: 'success' });
      setEditing(false);
    } catch (err) {
      Toast.show({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBorrower = () => {
    Alert.alert(
      t.deleteBorrower,
      t.confirmDelete,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.confirmDeleteYes,
          style: 'destructive',
          onPress: async () => {
            try {
              // Cascade: delete all loans first
              const borrowerLoans = await getLoansByBorrower(borrowerId);
              for (const loan of borrowerLoans) {
                await deleteLoan(loan.id);
              }
              await deleteBorrower(borrowerId);
              Toast.show({ text: t.deleted, type: 'success' });
              navigation.goBack();
            } catch (err) {
              Toast.show({ text: err.message, type: 'error' });
            }
          },
        },
      ]
    );
  };

  const groupedLoans = {
    overdue: loans.filter(l => l.status === 'overdue'),
    active: loans.filter(l => l.status === 'active'),
    paid: loans.filter(l => l.status === 'paid'),
  };

  const renderLoanCard = (loan) => (
    <TouchableOpacity
      key={loan.id}
      onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
      activeOpacity={0.8}
      style={{ marginBottom: 8 }}
    >
      <GlassCard>
        <View style={styles.loanRow}>
          <View style={styles.loanInfo}>
            <View style={styles.loanTopRow}>
              <Text style={[styles.loanPrincipal, { color: colors.text }]}>
                {formatCurrency(loan.currentPrincipal, loan.currency)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[loan.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[loan.status] }]}>
                  {t.status[loan.status] ?? loan.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.loanMeta, { color: colors.textMuted }]}>
              {loan.interestRate}% · {loan.scheduleMode} · {loan.repaymentType === 'interest_only' ? 'I/O' : 'P+I'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  const inputBg = isDark ? colors.surface : '#F2F4F8';

  if (!borrower) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB', alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{borrower.name}</Text>
          <TouchableOpacity onPress={() => setEditing(true)} style={[styles.editBtn, { borderColor: ACCENT }]} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={14} color={ACCENT} />
            <Text style={[styles.editBtnText, { color: ACCENT }]}>{t.edit}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Borrower info card */}
        <GlassCard style={{ marginBottom: 16 }}>
          <View style={styles.infoCard}>
            <View style={[styles.bigAvatar, { backgroundColor: ACCENT + '20' }]}>
              <Text style={[styles.bigAvatarText, { color: ACCENT }]}>{borrower.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.infoDetails}>
              <Text style={[styles.infoName, { color: colors.text }]}>{borrower.name}</Text>
              <Text style={[styles.infoPhone, { color: colors.textMuted }]}>{borrower.phone}</Text>
              {borrower.address ? <Text style={[styles.infoAddr, { color: colors.textMuted }]}>{borrower.address}</Text> : null}
            </View>
          </View>
        </GlassCard>

        {/* New Loan button */}
        <TouchableOpacity
          style={styles.newLoanBtn}
          onPress={() => navigation.navigate('CreateLoan', { prefillBorrowerId: borrower.id, prefillBorrowerName: borrower.name })}
          activeOpacity={0.82}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.newLoanBtnText}>{t.newLoan}</Text>
        </TouchableOpacity>

        {/* Loans sections */}
        {loadingLoans ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : loans.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>{t.noLoans}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t.noLoansHint}</Text>
          </View>
        ) : (
          <>
            {groupedLoans.overdue.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>{t.overdueLoans}</Text>
                {groupedLoans.overdue.map(renderLoanCard)}
              </>
            )}
            {groupedLoans.active.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.activeLoans}</Text>
                {groupedLoans.active.map(renderLoanCard)}
              </>
            )}
            {groupedLoans.paid.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.paidLoans}</Text>
                {groupedLoans.paid.map(renderLoanCard)}
              </>
            )}
          </>
        )}

        {/* Delete borrower */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: '#EF444430' }]}
          onPress={handleDeleteBorrower}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.deleteBtnText}>{t.deleteBorrower}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={[styles.modalCancel, { color: colors.textMuted }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t.edit}</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color={ACCENT} size="small" /> : <Text style={[styles.modalSave, { color: ACCENT }]}>{t.save}</Text>}
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <TextInput
                style={[styles.editInput, { backgroundColor: inputBg, color: colors.text }]}
                value={editName}
                onChangeText={setEditName}
                autoCapitalize="words"
                placeholder="Name"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.editInput, { backgroundColor: inputBg, color: colors.text }]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="Phone"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.editInput, { backgroundColor: inputBg, color: colors.text }]}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Address"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (fs) => StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: fs(18), fontWeight: '700', textAlign: 'center', marginHorizontal: 8 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editBtnText: { fontSize: fs(13), fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  bigAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { fontSize: fs(24), fontWeight: '700' },
  infoDetails: { flex: 1 },
  infoName: { fontSize: fs(18), fontWeight: '700', marginBottom: 4 },
  infoPhone: { fontSize: fs(14), marginBottom: 2 },
  infoAddr: { fontSize: fs(13) },
  newLoanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14, backgroundColor: ACCENT, marginBottom: 20,
  },
  newLoanBtnText: { color: '#fff', fontSize: fs(15), fontWeight: '700' },
  sectionTitle: { fontSize: fs(13), fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  loanRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  loanInfo: { flex: 1 },
  loanTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  loanPrincipal: { fontSize: fs(16), fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: fs(11), fontWeight: '700' },
  loanMeta: { fontSize: fs(13) },
  emptyWrap: { alignItems: 'center', gap: 8, paddingTop: 40 },
  emptyText: { fontSize: fs(16), fontWeight: '600' },
  emptyHint: { fontSize: fs(13) },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  deleteBtnText: { fontSize: fs(14), fontWeight: '600', color: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancel: { fontSize: fs(15) },
  modalTitle: { fontSize: fs(16), fontWeight: '700' },
  modalSave: { fontSize: fs(15), fontWeight: '700' },
  editInput: { height: 50, borderRadius: 12, paddingHorizontal: 14, fontSize: fs(15) },
});

export default BorrowerDetailScreen;
