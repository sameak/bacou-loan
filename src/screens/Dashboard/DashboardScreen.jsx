/**
 * DASHBOARD SCREEN
 * - Capital card: KHR + USD capital vs lent vs remaining
 * - 3 summary GlassCards: Total Lent | Outstanding | Overdue
 * - Overdue loans section (red)
 * - Due This Week section (amber)
 * - Open loans accruing section
 * - FAB → CreateLoanScreen
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { calcAccruedInterest, formatCurrency, today } from '../../services/loanService';
import { listenCapital } from '../../services/capitalService';
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
    // Capital
    myCapital: 'My Capital',
    capitalSet: 'Set Capital',
    lent: 'Lent',
    remaining: 'Remaining',
    noCapital: 'Tap Settings → My Capital to set your capital',
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
    myCapital: 'ដើមទុនខ្ញុំ',
    capitalSet: 'កំណត់ដើមទុន',
    lent: 'បានផ្ដល់',
    remaining: 'នៅសល់',
    noCapital: 'ទៅការកំណត់ → ដើមទុនខ្ញុំ ដើម្បីកំណត់',
  },
};

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const SummaryCard = ({ label, value, color, colors }) => {
  const { language, ff } = useLanguage();
  const isKhmer = language === 'km';
  return (
    <GlassCard style={{ flex: 1 }}>
      <View style={{ padding: 14, alignItems: 'center' }}>
        <Text style={[{ fontSize: 18, lineHeight: 23, marginBottom: 4, ...ff('800') }, { color }]}>{value}</Text>
        <Text style={[{ fontSize: 11, ...(isKhmer ? {} : { lineHeight: 15 }), ...ff('600'), textAlign: 'center' }, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </GlassCard>
  );
};

// One row in the capital card: Currency | Total | Lent | Remaining
const CapitalRow = ({ currency, total, lent, remaining, colors, ff, fs, isKhmer }) => {
  const remColor = remaining >= 0 ? '#10B981' : '#EF4444';
  return (
    <View style={capStyles.row}>
      {/* Currency badge */}
      <View style={[capStyles.badge, { backgroundColor: ACCENT + '18' }]}>
        <Text style={[capStyles.badgeText, { color: ACCENT }, ff('700')]}>{currency}</Text>
      </View>

      {/* Stats */}
      <View style={capStyles.stats}>
        <View style={capStyles.statCol}>
          <Text style={[capStyles.statVal, { color: colors.text }, ff('700')]}>{total}</Text>
          <Text style={[capStyles.statLbl, { color: colors.textMuted }, ff('500')]}>Total</Text>
        </View>
        <View style={[capStyles.divider, { backgroundColor: colors.border }]} />
        <View style={capStyles.statCol}>
          <Text style={[capStyles.statVal, { color: '#F59E0B' }, ff('700')]}>{lent}</Text>
          <Text style={[capStyles.statLbl, { color: colors.textMuted }, ff('500')]}>Lent</Text>
        </View>
        <View style={[capStyles.divider, { backgroundColor: colors.border }]} />
        <View style={capStyles.statCol}>
          <Text style={[capStyles.statVal, { color: remColor }, ff('700')]}>{remaining >= 0 ? remaining : '−' + Math.abs(remaining)}</Text>
          <Text style={[capStyles.statLbl, { color: colors.textMuted }, ff('500')]}>Left</Text>
        </View>
      </View>
    </View>
  );
};

const capStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  badge: { width: 44, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, lineHeight: 18 },
  stats: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 14, lineHeight: 19 },
  statLbl: { fontSize: 10.5, lineHeight: 14 },
  divider: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 4 },
});

const DashboardScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, ff, fs } = useLanguage();
  const isKhmer = language === 'km';
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff), [ff]);

  const { loans, loansLoaded: loaded } = useData();
  const loading = !loaded;

  const [capital, setCapital] = useState({ capitalUSD: 0, capitalKHR: 0 });

  useEffect(() => {
    return listenCapital(setCapital);
  }, []);

  const todayStr = today();

  const stats = useMemo(() => {
    const active = loans.filter(l => l.status !== 'paid');
    return {
      totalLent: loans.reduce((s, l) => s + (l.originalPrincipal ?? 0), 0),
      outstanding: active.reduce((s, l) => s + (l.currentPrincipal ?? 0), 0),
      overdue: active.filter(l => l.status === 'overdue').reduce((s, l) => s + (l.currentPrincipal ?? 0), 0),
    };
  }, [loans]);

  // Per-currency outstanding (only active loans)
  const currencyStats = useMemo(() => {
    const active = loans.filter(l => l.status !== 'paid');
    const usdLent = active.filter(l => l.currency === 'USD').reduce((s, l) => s + (l.currentPrincipal ?? 0), 0);
    const khrLent = active.filter(l => l.currency === 'KHR').reduce((s, l) => s + (l.currentPrincipal ?? 0), 0);
    return { usdLent, khrLent };
  }, [loans]);

  const hasCapital = capital.capitalUSD > 0 || capital.capitalKHR > 0;

  const overdueLoans = useMemo(() => loans.filter(l => l.status === 'overdue'), [loans]);
  const dueSoonLoans = useMemo(() => loans.filter(l => l.status === 'active' && l.scheduleMode === 'fixed'), [loans]);
  const openLoans = useMemo(() => loans.filter(l => l.scheduleMode === 'open' && l.status !== 'paid'), [loans]);

  const renderLoanRow = (loan, nav, color = colors.text) => (
    <TouchableOpacity
      key={loan.id}
      style={styles.loanRow}
      onPress={() => nav.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanDetail', params: { loanId: loan.id } } })}
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

  // Format helpers (no decimals for KHR, 2dp for USD)
  const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const fmtKHR = (n) => '៛' + Math.round(n).toLocaleString();

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
            {/* ── Capital Card ── */}
            <View style={styles.capitalHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, marginBottom: 0 }]}>{t.myCapital}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('SettingsTab')}
                style={[styles.capitalSetBtn, { backgroundColor: ACCENT + '15' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={13} color={ACCENT} />
                <Text style={[styles.capitalSetText, { color: ACCENT }, ff('600')]}>{t.capitalSet}</Text>
              </TouchableOpacity>
            </View>

            <GlassCard style={{ marginBottom: 20 }}>
              {!hasCapital ? (
                <View style={styles.emptySection}>
                  <Ionicons name="wallet-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted, flex: 1 }]}>{t.noCapital}</Text>
                </View>
              ) : (
                <>
                  {capital.capitalUSD > 0 && (
                    <CapitalRow
                      currency="USD"
                      total={fmtUSD(capital.capitalUSD)}
                      lent={fmtUSD(currencyStats.usdLent)}
                      remaining={fmtUSD(capital.capitalUSD - currencyStats.usdLent)}
                      colors={colors} ff={ff} fs={fs} isKhmer={isKhmer}
                    />
                  )}
                  {capital.capitalUSD > 0 && capital.capitalKHR > 0 && (
                    <View style={[styles.capDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]} />
                  )}
                  {capital.capitalKHR > 0 && (
                    <CapitalRow
                      currency="KHR"
                      total={fmtKHR(capital.capitalKHR)}
                      lent={fmtKHR(currencyStats.khrLent)}
                      remaining={fmtKHR(capital.capitalKHR - currencyStats.khrLent)}
                      colors={colors} ff={ff} fs={fs} isKhmer={isKhmer}
                    />
                  )}
                </>
              )}
            </GlassCard>

            {/* Summary row */}
            <View style={styles.summaryRow}>
              <SummaryCard label={t.totalLent}   value={stats.totalLent   > 0 ? '$' + Math.round(stats.totalLent).toLocaleString()   : '—'} color={ACCENT}                                                       colors={colors} />
              <SummaryCard label={t.outstanding} value={stats.outstanding > 0 ? '$' + Math.round(stats.outstanding).toLocaleString() : '—'} color='#F59E0B'                                                      colors={colors} />
              <SummaryCard label={t.overdue}     value={stats.overdue     > 0 ? '$' + Math.round(stats.overdue).toLocaleString()     : '—'} color={stats.overdue > 0 ? '#EF4444' : colors.textMuted}             colors={colors} />
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
                        onPress={() => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanDetail', params: { loanId: loan.id } } })}
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
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={() => navigation.navigate('CreateLoan')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  greeting: { fontSize: 13, lineHeight: 18, ...ff('500'), marginBottom: 2 },
  title: { fontSize: 28, lineHeight: 34, ...ff('800'), letterSpacing: 0 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  capitalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  capitalSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  capitalSetText: { fontSize: 12, lineHeight: 16 },
  capDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  sectionTitle: { fontSize: 13, lineHeight: 18, ...ff('700'), letterSpacing: 0, marginBottom: 8, marginTop: 4 },
  emptySection: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  emptyText: { fontSize: 14, lineHeight: 19, ...ff('400') },
  loanRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowDotInner: { width: 10, height: 10, borderRadius: 5 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, lineHeight: 19, ...ff('600'), marginBottom: 2 },
  rowMeta: { fontSize: 12, lineHeight: 16, ...ff('400') },
  emptyAll: { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyAllText: { fontSize: 14, lineHeight: 19, ...ff('400') },
  fab: {
    position: 'absolute', right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
});

export default DashboardScreen;
