/**
 * DASHBOARD SCREEN
 * - 3 summary GlassCards: Total Lent | Outstanding | Overdue
 * - Overdue loans section (red)
 * - Due This Week section (amber)
 * - Open loans accruing section
 * - Recent payments (last 5)
 * - FAB → CreateLoanScreen
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calcAccruedInterest, formatCurrency, today } from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import { Skeleton } from '../../components/Skeleton';

const ACCENT = '#6366F1';

const T = {
  en: {
    greeting: 'Good day',
    totalLent: 'Total Lent',
    outstanding: 'Outstanding',
    overdue: 'Overdue',
    overdueSection: 'Overdue Loans',
    dueThisWeek: 'Due This Week',
    openAccruing: 'Open Loans Accruing',
    recentPayments: 'Recent Payments',
    noOverdue: 'No overdue loans',
    noDue: 'All caught up',
    noOpen: 'No open loans',
    noPayments: 'No payments yet',
    noLoans: 'No loans yet — tap + to add',
    period: 'Period',
    accruing: 'Accruing',
  },
  km: {
    greeting: 'ថ្ងៃល្អ',
    totalLent: 'ផ្ដល់ទាំងអស់',
    outstanding: 'នៅជំពាក់',
    overdue: 'ហួសកំណត់',
    overdueSection: 'ប្រាក់កម្ចីហួសកំណត់',
    dueThisWeek: 'ត្រូវបង់សប្ដាហ៍នេះ',
    openAccruing: 'ប្រាក់កម្ចីបើក',
    recentPayments: 'ការបង់ថ្មីៗ',
    noOverdue: 'គ្មានប្រាក់កម្ចីហួសកំណត់',
    noDue: 'ល្អទាំងអស់',
    noOpen: 'គ្មានប្រាក់កម្ចីបើក',
    noPayments: 'មិនទាន់មានការបង់',
    noLoans: 'មិនទាន់មានប្រាក់កម្ចី — ចុច + ដើម្បីបន្ថែម',
    period: 'ដំណាក់',
    accruing: 'បង្ហូរ',
  },
};

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const SummaryCard = ({ label, value, color, colors, isDark }) => (
  <GlassCard style={{ flex: 1 }}>
    <View style={summaryStyles.card}>
      <Text style={[summaryStyles.value, { color }]}>{value}</Text>
      <Text style={[summaryStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  </GlassCard>
);

const summaryStyles = StyleSheet.create({
  card: { padding: 14, alignItems: 'center' },
  value: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

const DashboardScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const t = T[language] || T.en;

  const { loans, loansLoaded: loaded } = useData();
  const loading = !loaded;

  const todayStr = today();
  const weekEnd = addDays(todayStr, 7);

  const stats = useMemo(() => {
    const active = loans.filter(l => l.status !== 'paid');
    return {
      totalLent: loans.reduce((s, l) => s + (l.originalPrincipal ?? 0), 0),
      outstanding: active.reduce((s, l) => s + (l.currentPrincipal ?? 0), 0),
      overdue: active.filter(l => l.status === 'overdue').reduce((s, l) => s + (l.currentPrincipal ?? 0), 0),
    };
  }, [loans]);

  const overdueLoans = useMemo(() => loans.filter(l => l.status === 'overdue'), [loans]);

  const dueSoonLoans = useMemo(() => {
    // Fixed loans with upcoming periods due within 7 days
    // We approximate by checking startDate / frequency here
    // Real implementation: would need to check schedule entries
    return loans.filter(l => l.status === 'active' && l.scheduleMode === 'fixed');
  }, [loans]);

  const openLoans = useMemo(() => loans.filter(l => l.scheduleMode === 'open' && l.status !== 'paid'), [loans]);

  const renderLoanRow = (loan, navigation, color = colors.text) => (
    <TouchableOpacity
      key={loan.id}
      style={styles.loanRow}
      onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
      activeOpacity={0.8}
    >
      <View style={[styles.rowDot, { backgroundColor: color + '30' }]}>
        <View style={[styles.rowDotInner, { backgroundColor: color }]} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{loan.borrowerName}</Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
          {formatCurrency(loan.currentPrincipal, loan.currency)} · {loan.interestRate}%
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{t.greeting}</Text>
            <Text style={[styles.title, { color: colors.text }]}>Bacou</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <View style={styles.summaryRow}>
              {[1, 2, 3].map(i => (
                <GlassCard key={i} style={{ flex: 1 }}>
                  <View style={{ padding: 14, alignItems: 'center', gap: 8 }}>
                    <Skeleton width="70%" height={18} isDark={isDark} />
                    <Skeleton width="50%" height={11} isDark={isDark} />
                  </View>
                </GlassCard>
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* Summary row */}
            <View style={styles.summaryRow}>
              <SummaryCard label={t.totalLent} value={stats.totalLent > 0 ? '$' + Math.round(stats.totalLent).toLocaleString() : '—'} color={ACCENT} colors={colors} isDark={isDark} />
              <SummaryCard label={t.outstanding} value={stats.outstanding > 0 ? '$' + Math.round(stats.outstanding).toLocaleString() : '—'} color='#F59E0B' colors={colors} isDark={isDark} />
              <SummaryCard label={t.overdue} value={stats.overdue > 0 ? '$' + Math.round(stats.overdue).toLocaleString() : '—'} color={stats.overdue > 0 ? '#EF4444' : colors.textMuted} colors={colors} isDark={isDark} />
            </View>

            {/* Overdue section */}
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>{t.overdueSection}</Text>
            <GlassCard style={{ marginBottom: 16 }}>
              {overdueLoans.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="checkmark-circle-outline" size={20} color='#10B981' />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t.noOverdue}</Text>
                </View>
              ) : overdueLoans.slice(0, 5).map(l => renderLoanRow(l, navigation, '#EF4444'))}
            </GlassCard>

            {/* Due this week */}
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.dueThisWeek}</Text>
            <GlassCard style={{ marginBottom: 16 }}>
              {dueSoonLoans.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t.noDue}</Text>
                </View>
              ) : dueSoonLoans.slice(0, 5).map(l => renderLoanRow(l, navigation, '#F59E0B'))}
            </GlassCard>

            {/* Open loans accruing */}
            {openLoans.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.openAccruing}</Text>
                <GlassCard style={{ marginBottom: 16 }}>
                  {openLoans.map((loan, i) => {
                    const accrued = calcAccruedInterest(loan);
                    return (
                      <TouchableOpacity
                        key={loan.id}
                        style={[
                          styles.loanRow,
                          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                        ]}
                        onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.rowDot, { backgroundColor: '#F59E0B30' }]}>
                          <View style={[styles.rowDotInner, { backgroundColor: '#F59E0B' }]} />
                        </View>
                        <View style={styles.rowInfo}>
                          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{loan.borrowerName}</Text>
                          <Text style={[styles.rowMeta, { color: '#F59E0B' }]}>
                            {t.accruing}: {formatCurrency(accrued, loan.currency)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </GlassCard>
              </>
            )}

            {loans.length === 0 && (
              <View style={styles.emptyAll}>
                <Ionicons name="document-text-outline" size={52} color={colors.textMuted} />
                <Text style={[styles.emptyAllText, { color: colors.textMuted }]}>{t.noLoans}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateLoan')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  emptySection: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  emptyText: { fontSize: 14 },
  loanRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowDotInner: { width: 10, height: 10, borderRadius: 5 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  rowMeta: { fontSize: 12 },
  emptyAll: { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyAllText: { fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
});

export default DashboardScreen;
