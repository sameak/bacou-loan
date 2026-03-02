/**
 * LOAN DETAIL SCREEN
 * - Header: borrower name, status badge, principal
 * - Terms chips
 * - Progress bar
 * - Live accrual display (open mode)
 * - Schedule tab (fixed) / Payments tab
 * - FAB: Record Payment
 * - Top-Up button / Mark Paid button
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listenLoan,
  listenSchedule,
  listenPayments,
  calcAccruedInterest,
  formatCurrency,
  markLoanPaid,
  deleteLoan,
  refreshOverdueStatuses,
} from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';
import { Skeleton, SkeletonRow } from '../../components/Skeleton';

const ACCENT = '#6366F1';
const STATUS_COLORS = { active: '#10B981', overdue: '#EF4444', paid: '#9CA3AF' };
const PERIOD_STATUS_COLORS = { upcoming: '#6366F1', paid: '#10B981', partial: '#F59E0B', overdue: '#EF4444' };

const T = {
  en: {
    edit: 'Edit',
    schedule: 'Schedule',
    payments: 'Payments',
    recordPayment: 'Record Payment',
    topUp: 'Top Up',
    markPaid: 'Mark Fully Paid',
    confirmPaid: 'Mark this loan as fully paid?',
    confirmPaidYes: 'Mark Paid',
    confirmPaidCancel: 'Cancel',
    noPayments: 'No payments recorded',
    noSchedule: 'No schedule',
    status: { active: 'Active', overdue: 'Overdue', paid: 'Paid' },
    periodStatus: { upcoming: 'Upcoming', paid: 'Paid', partial: 'Partial', overdue: 'Overdue' },
    accruing: 'Accruing today',
    since: 'Since',
    originalPrincipal: 'Original',
    outstanding: 'Outstanding',
    totalRepaid: 'Repaid',
    totalInterest: 'Interest Paid',
    repaymentType: { interest_only: 'Interest Only', principal_and_interest: 'P+I' },
    basis: { flat: 'Flat', reducing: 'Reducing' },
    freq: { weekly: 'Weekly', monthly: 'Monthly' },
    markedPaid: 'Loan marked as paid',
    deleteLoan: 'Delete Loan',
    confirmDelete: 'Delete this loan and all its payment history? This cannot be undone.',
    confirmDeleteYes: 'Delete',
    deleted: 'Loan deleted',
    notes: 'NOTES',
  },
  km: {
    edit: 'កែប្រែ',
    schedule: 'កាលវិភាគ',
    payments: 'ការបង់',
    recordPayment: 'កត់ត្រាការបង់',
    topUp: 'បន្ថែម',
    markPaid: 'សម្គាល់ថាបានបង់',
    confirmPaid: 'សម្គាល់ប្រាក់កម្ចីនេះថាបានបង់ទាំងស្រុង?',
    confirmPaidYes: 'បានបង់',
    confirmPaidCancel: 'បោះបង់',
    noPayments: 'មិនទាន់មានការបង់',
    noSchedule: 'គ្មានកាលវិភាគ',
    status: { active: 'ដំណើរការ', overdue: 'ហួសកំណត់', paid: 'បានបង់' },
    periodStatus: { upcoming: 'នៅមុន', paid: 'បានបង់', partial: 'មួយផ្នែក', overdue: 'ហួសកំណត់' },
    accruing: 'បង្ហូរថ្ងៃនេះ',
    since: 'តាំងពី',
    originalPrincipal: 'ដើម',
    outstanding: 'នៅជំពាក់',
    totalRepaid: 'បានបង់',
    totalInterest: 'ការប្រាក់',
    repaymentType: { interest_only: 'តែការប្រាក់', principal_and_interest: 'ដើម+ការប្រាក់' },
    basis: { flat: 'ថេរ', reducing: 'ថយចុះ' },
    freq: { weekly: 'សប្ដាហ៍', monthly: 'ខែ' },
    markedPaid: 'បានសម្គាល់ថាបានបង់',
    deleteLoan: 'លុបប្រាក់កម្ចី',
    confirmDelete: 'លុបប្រាក់កម្ចីនេះ និងប្រវត្តិការបង់ទាំងអស់? មិនអាចមិនធ្វើវិញបានទេ។',
    confirmDeleteYes: 'លុប',
    deleted: 'បានលុបប្រាក់កម្ចី',
    notes: 'កំណត់ចំណាំ',
  },
};

const LoanDetailScreen = ({ navigation, route }) => {
  const { loanId } = route.params;
  const { colors, isDark } = useTheme();
  const { language, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs), [fs]);

  const [loan, setLoan] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [payments, setPayments] = useState([]);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Start all 3 listeners in parallel — no waterfall
  useEffect(() => {
    const unsubLoan = listenLoan(loanId, setLoan);
    const unsubSched = listenSchedule(loanId, data => {
      setSchedule(data);
      setScheduleLoaded(true);
    });
    const unsubPay = listenPayments(loanId, data => {
      setPayments(data);
      setPaymentsLoaded(true);
    });
    return () => { unsubLoan(); unsubSched(); unsubPay(); };
  }, [loanId]);

  // Refresh overdue statuses on load
  useEffect(() => {
    if (loan && loan.scheduleMode === 'fixed' && loan.status !== 'paid') {
      refreshOverdueStatuses([loan]);
    }
  }, [loan?.id]);

  const accrued = useMemo(() => {
    if (!loan || loan.scheduleMode !== 'open' || loan.status === 'paid') return null;
    return calcAccruedInterest(loan);
  }, [loan]);

  const progressPct = useMemo(() => {
    if (!loan || !loan.originalPrincipal) return 0;
    return Math.min(1, (loan.totalRepaid ?? 0) / loan.originalPrincipal);
  }, [loan]);

  const handleMarkPaid = () => {
    Alert.alert(
      t.markPaid,
      t.confirmPaid,
      [
        { text: t.confirmPaidCancel, style: 'cancel' },
        {
          text: t.confirmPaidYes,
          style: 'destructive',
          onPress: async () => {
            setMarkingPaid(true);
            try {
              await markLoanPaid(loanId);
              Toast.show({ text: t.markedPaid, type: 'success' });
            } catch (err) {
              Toast.show({ text: err.message, type: 'error' });
            } finally {
              setMarkingPaid(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t.deleteLoan,
      t.confirmDelete,
      [
        { text: t.confirmPaidCancel, style: 'cancel' },
        {
          text: t.confirmDeleteYes,
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteLoan(loanId);
              Toast.show({ text: t.deleted, type: 'success' });
              navigation.goBack();
            } catch (err) {
              Toast.show({ text: err.message, type: 'error' });
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!loan) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[loan.status] ?? STATUS_COLORS.active;
  const isOpen = loan.scheduleMode === 'open';
  const isPaid = loan.status === 'paid';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{loan.borrowerName}</Text>
          {!isPaid ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditLoan', { loan })}
                style={[styles.editBtn, { borderColor: ACCENT }]}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={14} color={ACCENT} />
                <Text style={[styles.editBtnText, { color: ACCENT }]}>{t.edit ?? 'Edit'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('TopUpLoan', { loan })}
                activeOpacity={0.7}
              >
                <Text style={[styles.topUpText, { color: ACCENT }]}>{t.topUp}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Summary card */}
        <GlassCard style={{ marginBottom: 12 }}>
          <View style={styles.summaryCard}>
            {/* Status + Currency */}
            <View style={styles.summaryTop}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{t.status[loan.status] ?? loan.status}</Text>
              </View>
              <Text style={[styles.currency, { color: colors.textMuted }]}>{loan.currency}</Text>
            </View>

            {/* Principal */}
            <Text style={[styles.principalValue, { color: colors.text }]}>
              {formatCurrency(loan.currentPrincipal, loan.currency)}
            </Text>
            <Text style={[styles.principalLabel, { color: colors.textMuted }]}>{t.outstanding}</Text>

            {/* Terms chips */}
            <View style={styles.chipsRow}>
              {[
                `${loan.interestRate}%`,
                t.basis[loan.interestBasis] ?? loan.interestBasis,
                t.repaymentType[loan.repaymentType] ?? loan.repaymentType,
                t.freq[loan.frequency] ?? loan.frequency,
                isOpen ? 'Open' : `${loan.totalPeriods} periods`,
              ].map((chip, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                  <Text style={[styles.chipText, { color: colors.textMuted }]}>{chip}</Text>
                </View>
              ))}
            </View>

            {/* Open mode live accrual */}
            {accrued !== null && (
              <View style={[styles.accrualBanner, { backgroundColor: '#F59E0B' + '15' }]}>
                <Ionicons name="time-outline" size={14} color="#F59E0B" />
                <Text style={styles.accrualText}>
                  {t.accruing}: {formatCurrency(accrued, loan.currency)}
                  {loan.lastPaymentDate ? ` (${t.since} ${loan.lastPaymentDate})` : ''}
                </Text>
              </View>
            )}

            {/* Progress bar */}
            {loan.originalPrincipal > 0 && (
              <View style={styles.progressSection}>
                <View style={[styles.progressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                  <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%`, backgroundColor: '#10B981' }]} />
                </View>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                  {formatCurrency(loan.totalRepaid ?? 0, loan.currency)} / {formatCurrency(loan.originalPrincipal, loan.currency)} ({Math.round(progressPct * 100)}%)
                </Text>
              </View>
            )}

            {/* Stats row */}
            <View style={[styles.statsRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(loan.originalPrincipal, loan.currency)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t.originalPrincipal}</Text>
              </View>
              <View style={[styles.stat, styles.statBorder, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{formatCurrency(loan.totalRepaid ?? 0, loan.currency)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t.totalRepaid}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{formatCurrency(loan.totalInterestPaid ?? 0, loan.currency)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t.totalInterest}</Text>
              </View>
            </View>

            {/* Notes */}
            {!!loan.notes && (
              <View style={[styles.notesSection, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Text style={[styles.notesLabel, { color: colors.textMuted }]}>{t.notes}</Text>
                <Text style={[styles.notesText, { color: colors.text }]}>{loan.notes}</Text>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Tab bar */}
        <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
          {[
            { key: 'schedule', label: t.schedule },
            { key: 'payments', label: t.payments },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && { backgroundColor: isDark ? '#fff' : '#1C1C1E' }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, { color: activeTab === tab.key ? (isDark ? '#000' : '#fff') : colors.textMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Schedule tab */}
        {activeTab === 'schedule' && (
          <GlassCard>
            {!scheduleLoaded ? (
              <>
                <SkeletonRow isDark={isDark} first />
                <SkeletonRow isDark={isDark} />
                <SkeletonRow isDark={isDark} />
              </>
            ) : isOpen ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Ionicons name="infinite-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.openModeNote, { color: colors.textMuted }]}>
                  Open-ended loan — interest accrues daily
                </Text>
              </View>
            ) : schedule.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t.noSchedule}</Text>
              </View>
            ) : (
              schedule.map((period, index) => {
                const pColor = PERIOD_STATUS_COLORS[period.status] ?? PERIOD_STATUS_COLORS.upcoming;
                return (
                  <View
                    key={period.id}
                    style={[
                      styles.periodRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                    ]}
                  >
                    <View style={[styles.periodNum, { backgroundColor: pColor + '20' }]}>
                      <Text style={[styles.periodNumText, { color: pColor }]}>{period.periodNumber}</Text>
                    </View>
                    <View style={styles.periodInfo}>
                      <Text style={[styles.periodDate, { color: colors.text }]}>{period.dueDate}</Text>
                      <Text style={[styles.periodMeta, { color: colors.textMuted }]}>
                        P: {formatCurrency(period.principalDue, loan.currency)} + I: {formatCurrency(period.interestDue, loan.currency)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.periodTotal, { color: colors.text }]}>{formatCurrency(period.totalDue, loan.currency)}</Text>
                      <View style={[styles.periodStatusBadge, { backgroundColor: pColor + '20' }]}>
                        <Text style={[styles.periodStatusText, { color: pColor }]}>{t.periodStatus[period.status] ?? period.status}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </GlassCard>
        )}

        {/* Payments tab */}
        {activeTab === 'payments' && (
          <GlassCard>
            {!paymentsLoaded ? (
              <>
                <SkeletonRow isDark={isDark} first />
                <SkeletonRow isDark={isDark} />
              </>
            ) : payments.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t.noPayments}</Text>
              </View>
            ) : (
              payments.map((pay, index) => (
                <View
                  key={pay.id}
                  style={[
                    styles.payRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                  ]}
                >
                  <View style={[styles.payIcon, { backgroundColor: '#10B981' + '20' }]}>
                    <Ionicons name="cash-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.payInfo}>
                    <Text style={[styles.payDate, { color: colors.text }]}>{pay.date}</Text>
                    <Text style={[styles.payMeta, { color: colors.textMuted }]}>
                      P: {formatCurrency(pay.principalAmount, loan.currency)} + I: {formatCurrency(pay.interestAmount, loan.currency)}
                      {pay.daysAccrued ? ` · ${pay.daysAccrued}d` : ''}
                    </Text>
                    {pay.notes ? <Text style={[styles.payNotes, { color: colors.textMuted }]}>{pay.notes}</Text> : null}
                  </View>
                  <Text style={[styles.payTotal, { color: '#10B981' }]}>{formatCurrency(pay.totalAmount, loan.currency)}</Text>
                </View>
              ))
            )}
          </GlassCard>
        )}

        {/* Mark paid button */}
        {!isPaid && (
          <TouchableOpacity
            style={[styles.markPaidBtn, { borderColor: colors.border }]}
            onPress={handleMarkPaid}
            disabled={markingPaid}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.markPaidText, { color: colors.textMuted }]}>{t.markPaid}</Text>
          </TouchableOpacity>
        )}

        {/* Delete loan button */}
        <TouchableOpacity
          style={[styles.markPaidBtn, { borderColor: '#EF444430', marginTop: 8 }]}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={[styles.markPaidText, { color: '#EF4444' }]}>{t.deleteLoan}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FAB: Record Payment */}
      {!isPaid && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('RecordPayment', { loan })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const makeStyles = (fs) => StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: fs(18), fontWeight: '700', textAlign: 'center', marginHorizontal: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 90, justifyContent: 'flex-end' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editBtnText: { fontSize: fs(13), fontWeight: '600' },
  topUpText: { fontSize: fs(15), fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 },

  // Summary card
  summaryCard: { padding: 20 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: fs(12), fontWeight: '700' },
  currency: { fontSize: fs(13), fontWeight: '600' },
  principalValue: { fontSize: fs(32), fontWeight: '800', marginBottom: 2 },
  principalLabel: { fontSize: fs(13), marginBottom: 16 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipText: { fontSize: fs(12), fontWeight: '500' },
  accrualBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  accrualText: { fontSize: fs(12), color: '#F59E0B', fontWeight: '500', flex: 1 },
  progressSection: { marginBottom: 16 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: fs(12) },
  statsRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  statValue: { fontSize: fs(14), fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: fs(11) },

  // Notes
  notesSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 4 },
  notesLabel: { fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  notesText: { fontSize: fs(14), lineHeight: 20 },

  // Tab bar
  tabBar: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabLabel: { fontSize: fs(13), fontWeight: '600' },

  // Schedule
  periodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  periodNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  periodNumText: { fontSize: fs(12), fontWeight: '700' },
  periodInfo: { flex: 1 },
  periodDate: { fontSize: fs(14), fontWeight: '600', marginBottom: 2 },
  periodMeta: { fontSize: fs(12) },
  periodTotal: { fontSize: fs(14), fontWeight: '700', marginBottom: 4 },
  periodStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  periodStatusText: { fontSize: fs(10), fontWeight: '700' },

  // Payments
  payRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  payIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  payInfo: { flex: 1 },
  payDate: { fontSize: fs(14), fontWeight: '600', marginBottom: 2 },
  payMeta: { fontSize: fs(12) },
  payNotes: { fontSize: fs(11), marginTop: 2 },
  payTotal: { fontSize: fs(15), fontWeight: '700' },

  // Mark paid
  markPaidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  markPaidText: { fontSize: fs(14), fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },

  // Misc
  openModeNote: { fontSize: fs(14), textAlign: 'center', marginTop: 8 },
  emptyText: { fontSize: fs(14) },
});

export default LoanDetailScreen;
