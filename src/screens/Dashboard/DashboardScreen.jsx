/**
 * DASHBOARD SCREEN — Dynamic homepage v2
 *
 * Sections:
 *   1. Header: time-based greeting + health score
 *   2. This Month: interest earned + principal collected, % change vs last month
 *   3. 6-Month Interest Bar Chart
 *   4. Capital Utilization (progress bars)
 *   5. Quick Stats Row: active count, outstanding, on-track %
 *   6. Overdue Alert Banner
 *   7. Portfolio: top active/overdue loans
 *   8. Recent Activity: last 6 payments
 *   9. FAB → CreateLoan
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const NAVBAR_LOGO = require('../../../assets/images/navbar-logo.png');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { getBorrowerPayments, formatCurrency, today } from '../../services/loanService';
import { listenCapital } from '../../services/capitalService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import { Skeleton } from '../../components/Skeleton';

const ACCENT = '#00C2B2';
const GREEN  = '#10B981';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

/** Return 'YYYY-MM' for (today + offset months) */
function monthKey(offset = 0) {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
}

const T = {
  en: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    // Health
    portfolioHealth: 'Portfolio Health',
    great: 'Great', good: 'Good', fair: 'Fair', poor: 'Poor',
    // Income
    thisMonth: 'This Month',
    interest: 'Interest',
    principal: 'Collected',
    vsLastMonth: 'vs last month',
    newEarning: 'First earnings',
    // Chart
    chart6m: '6-Month Interest',
    khrNote: '+ KHR interest in Reports',
    // Capital
    myCapital: 'MY CAPITAL',
    capitalSet: 'Set Capital',
    utilized: 'utilized',
    available: 'free',
    noCapital: 'Tap Settings → My Capital to set your capital',
    lent: 'Lent',
    total: 'Total',
    // Stats
    active: 'Active',
    onTrack: 'On Track',
    outstanding: 'Outstanding',
    // Alerts
    overdueAlert: (n, amt) => `${n} overdue · ${amt} at risk`,
    // Portfolio
    portfolio: 'PORTFOLIO',
    overdue: 'Overdue',
    // Activity
    recentActivity: 'RECENT ACTIVITY',
    noActivity: 'No payments recorded yet',
    // Status
    statusActive: 'Active',
    statusOverdue: 'Overdue',
    // Upcoming payments
    upcomingPayments: 'UPCOMING PAYMENTS',
    allOnTrack: 'All payments on track',
    today: 'Today',
    inDays: n => `in ${n} day${n === 1 ? '' : 's'}`,
    overdueDays: n => `${n} day${n === 1 ? '' : 's'} overdue`,
    // Chart months (single char)
    chartMonths: ['J','F','M','A','M','J','J','A','S','O','N','D'],
  },
  km: {
    morning: 'អរុណសួស្ដី',
    afternoon: 'ទិវាសួស្ដី',
    evening: 'សាយ័ណ្ហសួស្ដី',
    portfolioHealth: 'សុខភាពផតហ្វូលីយ៉ូ',
    great: 'ល្អខ្លាំង', good: 'ល្អ', fair: 'មធ្យម', poor: 'ខ្សោយ',
    thisMonth: 'ខែនេះ',
    interest: 'ការប្រាក់',
    principal: 'ដើមទុន',
    vsLastMonth: 'ធៀបខែមុន',
    newEarning: 'ដំបូង',
    chart6m: 'ការប្រាក់ ៦ ខែ',
    khrNote: '+ ការប្រាក់រៀលក្នុងរបាយការណ៍',
    myCapital: 'ដើមទុនខ្ញុំ',
    capitalSet: 'កំណត់ដើមទុន',
    utilized: 'បានប្រើ',
    available: 'នៅសល់',
    noCapital: 'ទៅការកំណត់ → ដើមទុនខ្ញុំ ដើម្បីកំណត់',
    lent: 'បានផ្ដល់',
    total: 'សរុប',
    active: 'កម្ចីសរុប',
    onTrack: 'ទៀងទាត់',
    outstanding: 'កម្ចីដែលបានផ្តល់',
    overdueAlert: (n, amt) => `${n} ហួសកំណត់ · ${amt} ប្រយ័ត្ន`,
    portfolio: 'បញ្ជីប្រាក់កម្ចី',
    overdue: 'ហួសកំណត់',
    recentActivity: 'សកម្មភាពថ្មីៗ',
    noActivity: 'មិនទាន់មានការបង់',
    statusActive: 'ដំណើរការ',
    statusOverdue: 'ហួសកំណត់',
    upcomingPayments: 'ការទូទាត់ខាងមុខ',
    allOnTrack: 'ការទូទាត់ទាំងអស់ទន្ទ្រាន',
    today: 'ថ្ងៃនេះ',
    inDays: n => `${n} ថ្ងៃទៀត`,
    overdueDays: n => `ហួស ${n} ថ្ងៃ`,
    chartMonths: ['១','២','៣','៤','៥','៦','៧','៨','៩','១០','១១','១២'],
  },
};

// ── Screen ────────────────────────────────────────────────────────────────────

const DashboardScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff, fs), [ff, fs]);

  const { loans, loansLoaded } = useData();
  const [capital, setCapital]         = useState({ capitalUSD: 0, capitalKHR: 0 });
  const [payments, setPayments]       = useState([]);
  const [paymentsLoading, setLoading] = useState(true);
  const [upcoming, setUpcoming]       = useState([]);

  useEffect(() => listenCapital(setCapital), []);

  useEffect(() => {
    if (!loansLoaded) return;
    getBorrowerPayments(loans)
      .then(p => { setPayments(p); setLoading(false); })
      .catch(() => setLoading(false));

    // Fetch upcoming payments from fixed-mode active/overdue loans
    const fixedActive = loans.filter(
      l => l.scheduleMode === 'fixed' && (l.status === 'active' || l.status === 'overdue'),
    );
    const rows = [];
    Promise.all(
      fixedActive.map(async loan => {
        try {
          const snap = await getDocs(collection(db, 'loans', loan.id, 'schedule'));
          const next = snap.docs
            .map(d => d.data())
            .filter(p => p.status !== 'paid')
            .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];
          if (next) rows.push({ ...next, loanId: loan.id, borrowerName: loan.borrowerName, currency: loan.currency });
        } catch (_) {}
      }),
    ).then(() => {
      setUpcoming(
        rows.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 5),
      );
    });
  }, [loansLoaded]);

  const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtKHR = n => '៛' + Math.round(n).toLocaleString();

  const navLoan     = id => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanDetail', params: { loanId: id } } });
  const navLoanList = f  => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanList',   params: { initialFilter: f } } });

  // ── Loan stats (instant, no payment loading needed) ───────────────────────
  const loanStats = useMemo(() => {
    const open       = loans.filter(l => l.status !== 'paid' && l.status !== 'written_off');
    const active     = loans.filter(l => l.status === 'active');
    const overdue    = loans.filter(l => l.status === 'overdue');
    const writtenOff = loans.filter(l => l.status === 'written_off');

    const sum = (arr, key) => arr.reduce((s, l) => s + (l[key] ?? 0), 0);

    const outUSD = sum(open.filter(l => l.currency === 'USD'),     'currentPrincipal');
    const outKHR = sum(open.filter(l => l.currency === 'KHR'),     'currentPrincipal');
    const ovdUSD = sum(overdue.filter(l => l.currency === 'USD'),  'currentPrincipal');
    const ovdKHR = sum(overdue.filter(l => l.currency === 'KHR'),  'currentPrincipal');

    const totalOpen   = active.length + overdue.length;
    const onTrackPct  = totalOpen > 0 ? Math.round((active.length / totalOpen) * 100) : 100;
    const overduePct  = totalOpen > 0 ? overdue.length / totalOpen : 0;
    const health      = Math.max(0, Math.min(100, Math.round(100 - overduePct * 60 - (writtenOff.length > 0 ? 5 : 0))));

    return { activeCount: active.length, overdueCount: overdue.length, totalOpen, outUSD, outKHR, ovdUSD, ovdKHR, onTrackPct, health };
  }, [loans]);

  // ── Income this month vs last month (needs payments) ──────────────────────
  const incomeData = useMemo(() => {
    const thisM = monthKey(0);
    const lastM = monthKey(-1);
    let tiUSD = 0, tiKHR = 0, tpUSD = 0, tpKHR = 0, liUSD = 0;
    for (const p of payments) {
      const m    = p.date?.slice(0, 7);
      const isKHR = (p.loanCurrency ?? p.currency) === 'KHR';
      if (m === thisM) {
        if (isKHR) { tiKHR += p.interestAmount ?? 0; tpKHR += p.principalAmount ?? 0; }
        else        { tiUSD += p.interestAmount ?? 0; tpUSD += p.principalAmount ?? 0; }
      } else if (m === lastM && !isKHR) {
        liUSD += p.interestAmount ?? 0;
      }
    }
    const changeUSD = liUSD > 0 ? Math.round(((tiUSD - liUSD) / liUSD) * 100) : null;
    return { tiUSD, tiKHR, tpUSD, tpKHR, changeUSD };
  }, [payments]);

  // ── 6-month chart (USD interest per month) ────────────────────────────────
  const chartData = useMemo(() => {
    const keys  = Array.from({ length: 6 }, (_, i) => monthKey(i - 5));
    const data  = keys.map(mk => {
      const ps   = payments.filter(p => p.date?.slice(0, 7) === mk);
      const usd  = ps.filter(p => (p.loanCurrency ?? p.currency) !== 'KHR').reduce((s, p) => s + (p.interestAmount ?? 0), 0);
      const khr  = ps.filter(p => (p.loanCurrency ?? p.currency) === 'KHR').reduce((s, p) => s + (p.interestAmount ?? 0), 0);
      const [, m] = mk.split('-').map(Number);
      return { key: mk, usd, khr, mIdx: m - 1 };
    });
    const maxUSD = Math.max(...data.map(d => d.usd), 1);
    const hasKHR = data.some(d => d.khr > 0);
    return { data, maxUSD, hasKHR };
  }, [payments]);

  // ── Capital utilization ───────────────────────────────────────────────────
  const capitalUtil = useMemo(() => ({
    usdPct: capital.capitalUSD > 0 ? Math.min(100, Math.round((loanStats.outUSD / capital.capitalUSD) * 100)) : 0,
    khrPct: capital.capitalKHR > 0 ? Math.min(100, Math.round((loanStats.outKHR / capital.capitalKHR) * 100)) : 0,
  }), [capital, loanStats]);

  // ── Top active/overdue loans for portfolio section ────────────────────────
  const portfolioLoans = useMemo(() =>
    loans.filter(l => l.status === 'active' || l.status === 'overdue')
         .sort((a, b) => (b.currentPrincipal ?? 0) - (a.currentPrincipal ?? 0))
         .slice(0, 5),
    [loans]
  );

  // ── Recent activity (last 6 payments) ─────────────────────────────────────
  const recentPayments = useMemo(() => payments.slice(0, 6), [payments]);

  // ── Derived display values ────────────────────────────────────────────────
  const hasCapital     = capital.capitalUSD > 0 || capital.capitalKHR > 0;
  const { health, onTrackPct, overdueCount, activeCount } = loanStats;
  const healthColor    = health >= 80 ? GREEN : health >= 60 ? AMBER : health >= 40 ? '#F97316' : RED;
  const healthLabel    = health >= 80 ? t.great : health >= 60 ? t.good : health >= 40 ? t.fair : t.poor;
  const hour           = new Date().getHours();
  const greetKey       = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const userName       = auth.currentUser?.displayName?.split(' ')[0] ?? '';
  const thisMonthKey   = monthKey(0);
  const sectionUp = s => language === 'en' ? s.toUpperCase() : s;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>

      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textMuted }, ff('400')]}>{t[greetKey]}{userName ? `, ${userName}` : ''}</Text>
            <Image source={NAVBAR_LOGO} style={styles.navLogo} resizeMode="contain" />
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
              onPress={() => navigation.navigate('ExchangeRates')}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
              onPress={() => navigation.navigate('Reports')}
              activeOpacity={0.7}
            >
              <Ionicons name="bar-chart-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── 1. Portfolio Health ── */}
        <GlassCard style={styles.card}>
          <View style={styles.cardInner}>
            <View style={styles.healthTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }, ff('600')]}>{t.portfolioHealth}</Text>
                <View style={styles.healthScoreRow}>
                  <Text style={[styles.healthNum, { color: healthColor }, ff('400')]}>{health}</Text>
                  <Text style={[styles.healthDenom, { color: colors.textMuted }, ff('400')]}>/100</Text>
                </View>
              </View>
              <View style={[styles.healthBadge, { backgroundColor: healthColor + '20' }]}>
                <Text style={[styles.healthBadgeText, { color: healthColor }, ff('600')]}>{healthLabel}</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={[styles.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.trackFill, { width: `${health}%`, backgroundColor: healthColor }]} />
            </View>

            {/* Loan breakdown dots */}
            <View style={styles.healthDots}>
              <View style={styles.healthDot}>
                <View style={[styles.dot, { backgroundColor: GREEN }]} />
                <Text style={[styles.healthDotText, { color: colors.textMuted }, ff('400')]}>{activeCount} {t.active}</Text>
              </View>
              <View style={styles.healthDot}>
                <View style={[styles.dot, { backgroundColor: RED }]} />
                <Text style={[styles.healthDotText, { color: colors.textMuted }, ff('400')]}>{overdueCount} {t.overdue}</Text>
              </View>
              <View style={styles.healthDot}>
                <View style={[styles.dot, { backgroundColor: ACCENT }]} />
                <Text style={[styles.healthDotText, { color: colors.textMuted }, ff('400')]}>{onTrackPct}% {t.onTrack}</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* ── 2. This Month Income ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('600')]}>{sectionUp(t.thisMonth)}</Text>
        <View style={styles.twoCol}>

          {/* Interest card */}
          <GlassCard style={{ flex: 1 }}>
            <View style={styles.incomeInner}>
              <View style={[styles.incomeTag, { backgroundColor: ACCENT + '18' }]}>
                <Ionicons name="trending-up-outline" size={11} color={ACCENT} />
                <Text style={[styles.incomeTagText, { color: ACCENT }, ff('600')]}>{t.interest}</Text>
              </View>
              {paymentsLoading ? (
                <View style={{ gap: 6, marginVertical: 4 }}>
                  <Skeleton width="75%" height={26} isDark={isDark} />
                  <Skeleton width="50%" height={14} isDark={isDark} />
                </View>
              ) : (
                <>
                  <Text style={[styles.incomeMain, { color: ACCENT }, ff('400')]}>{fmtUSD(incomeData.tiUSD)}</Text>
                  {incomeData.tiKHR > 0 && <Text style={[styles.incomeSub, { color: ACCENT + 'BB' }, ff('400')]}>{fmtKHR(incomeData.tiKHR)}</Text>}
                  {incomeData.changeUSD !== null ? (
                    <View style={styles.changeRow}>
                      <Ionicons name={incomeData.changeUSD >= 0 ? 'arrow-up' : 'arrow-down'} size={10} color={incomeData.changeUSD >= 0 ? GREEN : RED} />
                      <Text style={[styles.changeText, { color: incomeData.changeUSD >= 0 ? GREEN : RED }, ff('600')]}>
                        {Math.abs(incomeData.changeUSD)}% {t.vsLastMonth}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.changeText, { color: colors.textMuted }, ff('400')]}>{t.newEarning}</Text>
                  )}
                </>
              )}
            </View>
          </GlassCard>

          {/* Principal collected card */}
          <GlassCard style={{ flex: 1 }}>
            <View style={styles.incomeInner}>
              <View style={[styles.incomeTag, { backgroundColor: GREEN + '18' }]}>
                <Ionicons name="cash-outline" size={11} color={GREEN} />
                <Text style={[styles.incomeTagText, { color: GREEN }, ff('600')]}>{t.principal}</Text>
              </View>
              {paymentsLoading ? (
                <View style={{ gap: 6, marginVertical: 4 }}>
                  <Skeleton width="75%" height={26} isDark={isDark} />
                  <Skeleton width="50%" height={14} isDark={isDark} />
                </View>
              ) : (
                <>
                  <Text style={[styles.incomeMain, { color: GREEN }, ff('400')]}>{fmtUSD(incomeData.tpUSD)}</Text>
                  {incomeData.tpKHR > 0 && <Text style={[styles.incomeSub, { color: GREEN + 'BB' }, ff('400')]}>{fmtKHR(incomeData.tpKHR)}</Text>}
                  <Text style={[styles.changeText, { color: colors.textMuted }, ff('400')]}>{t.thisMonth}</Text>
                </>
              )}
            </View>
          </GlassCard>
        </View>

        {/* ── 3. 6-Month Bar Chart ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('600')]}>{sectionUp(t.chart6m)}</Text>
        <GlassCard style={styles.card}>
          <View style={styles.chartInner}>
            {paymentsLoading ? (
              <View style={styles.chartSkeleton}>
                {[60, 40, 80, 55, 70, 90].map((h, i) => (
                  <View key={i} style={styles.chartSkeletonBarWrap}>
                    <Skeleton width="70%" height={h} isDark={isDark} />
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View style={styles.barsArea}>
                  {chartData.data.map((d) => {
                    const pct         = Math.max(4, Math.round((d.usd / chartData.maxUSD) * 100));
                    const isCurrent   = d.key === thisMonthKey;
                    const barColor    = isCurrent ? ACCENT : ACCENT + '50';
                    const labelColor  = isCurrent ? colors.text : colors.textMuted;
                    return (
                      <View key={d.key} style={styles.barGroup}>
                        {/* Amount above current month bar */}
                        {isCurrent && d.usd > 0 && (
                          <Text style={[styles.barCurLabel, { color: ACCENT }, ff('400')]}>{fmtUSD(d.usd)}</Text>
                        )}
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { height: `${pct}%`, backgroundColor: barColor, borderRadius: isCurrent ? 6 : 4 }]} />
                        </View>
                        <Text style={[styles.barMonthLabel, { color: labelColor }, ff(isCurrent ? '600' : '400')]}>
                          {t.chartMonths[d.mIdx]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {chartData.hasKHR && (
                  <Text style={[styles.chartNote, { color: colors.textMuted }, ff('400')]}>{t.khrNote}</Text>
                )}
              </>
            )}
          </View>
        </GlassCard>

        {/* ── 3b. Upcoming Payments ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('600')]}>{sectionUp(t.upcomingPayments)}</Text>
        <GlassCard style={styles.card}>
          {upcoming.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={GREEN} />
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400')]}>{t.allOnTrack}</Text>
            </View>
          ) : (
            upcoming.map((item, i) => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const diffMs   = new Date(item.dueDate) - new Date(todayStr);
              const diffDays = Math.round(diffMs / 86400000);
              const isOverdue = diffDays < 0;
              const isToday   = diffDays === 0;
              const rowColor  = isOverdue ? RED : isToday ? AMBER : GREEN;
              const chipLabel = isOverdue
                ? t.overdueDays(Math.abs(diffDays))
                : isToday
                ? t.today
                : t.inDays(diffDays);
              const fmtAmt = item.currency === 'KHR'
                ? fmtKHR(item.totalDue ?? 0)
                : fmtUSD(item.totalDue ?? 0);
              return (
                <TouchableOpacity
                  key={`${item.loanId}-${item.dueDate}-${i}`}
                  style={[
                    styles.upRow,
                    i < upcoming.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                  onPress={() => navLoan(item.loanId)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.upDot, { backgroundColor: rowColor + '22' }]}>
                    <View style={[styles.upDotInner, { backgroundColor: rowColor }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.upName, { color: colors.text }, ff('400')]} numberOfLines={1}>{item.borrowerName}</Text>
                    <Text style={[styles.upDate, { color: colors.textMuted }, ff('400')]}>{item.dueDate}</Text>
                  </View>
                  <View style={styles.upRight}>
                    <Text style={[styles.upAmount, { color: rowColor }, ff('600')]}>{fmtAmt}</Text>
                    <View style={[styles.upChip, { backgroundColor: rowColor + '18' }]}>
                      <Text style={[styles.upChipText, { color: rowColor }, ff('600')]}>{chipLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </GlassCard>

        {/* ── 4. Capital Utilization ── */}
        {hasCapital && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('600')]}>{sectionUp(t.myCapital)}</Text>
            <GlassCard style={styles.card}>
              <View style={styles.capitalInner}>
                {capital.capitalUSD > 0 && (
                  <View style={styles.capitalItem}>
                    <View style={styles.capitalTopRow}>
                      <View style={[styles.cBadge, { backgroundColor: ACCENT + '18' }]}>
                        <Text style={[styles.cBadgeText, { color: ACCENT }, ff('600')]}>🇺🇸 USD</Text>
                      </View>
                      <Text style={[styles.cPct, { color: colors.text }, ff('400')]}>{capitalUtil.usdPct}%</Text>
                      <Text style={[styles.cAvail, { color: colors.textMuted }, ff('400')]}>
                        {fmtUSD(capital.capitalUSD - loanStats.outUSD)} {t.available}
                      </Text>
                    </View>
                    <View style={[styles.utilTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                      <View style={[styles.utilFill, { width: `${capitalUtil.usdPct}%`, backgroundColor: capitalUtil.usdPct > 90 ? RED : capitalUtil.usdPct > 70 ? AMBER : ACCENT }]} />
                    </View>
                    <View style={styles.capitalSubRow}>
                      <Text style={[styles.capitalSub, { color: colors.textMuted }, ff('400')]}>{t.lent} {fmtUSD(loanStats.outUSD)}</Text>
                      <Text style={[styles.capitalSub, { color: colors.textMuted }, ff('400')]}>{t.total} {fmtUSD(capital.capitalUSD)}</Text>
                    </View>
                  </View>
                )}

                {capital.capitalUSD > 0 && capital.capitalKHR > 0 && (
                  <View style={[styles.capDivider, { backgroundColor: colors.border }]} />
                )}

                {capital.capitalKHR > 0 && (
                  <View style={styles.capitalItem}>
                    <View style={styles.capitalTopRow}>
                      <View style={[styles.cBadge, { backgroundColor: AMBER + '18' }]}>
                        <Text style={[styles.cBadgeText, { color: AMBER }, ff('600')]}>🇰🇭 KHR</Text>
                      </View>
                      <Text style={[styles.cPct, { color: colors.text }, ff('400')]}>{capitalUtil.khrPct}%</Text>
                      <Text style={[styles.cAvail, { color: colors.textMuted }, ff('400')]}>
                        {fmtKHR(capital.capitalKHR - loanStats.outKHR)} {t.available}
                      </Text>
                    </View>
                    <View style={[styles.utilTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                      <View style={[styles.utilFill, { width: `${capitalUtil.khrPct}%`, backgroundColor: capitalUtil.khrPct > 90 ? RED : capitalUtil.khrPct > 70 ? AMBER : GREEN }]} />
                    </View>
                    <View style={styles.capitalSubRow}>
                      <Text style={[styles.capitalSub, { color: colors.textMuted }, ff('400')]}>{t.lent} {fmtKHR(loanStats.outKHR)}</Text>
                      <Text style={[styles.capitalSub, { color: colors.textMuted }, ff('400')]}>{t.total} {fmtKHR(capital.capitalKHR)}</Text>
                    </View>
                  </View>
                )}
              </View>
            </GlassCard>
          </>
        )}

        {/* ── 5. Quick Stats ── */}
        <View style={styles.statsRow}>
          <GlassCard style={{ flex: 1 }}>
            <View style={styles.statInner}>
              <Text style={[styles.statMain, { color: ACCENT }, ff('400')]}>{activeCount + overdueCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }, ff('600')]}>{t.active}</Text>
            </View>
          </GlassCard>

          <GlassCard style={{ flex: 1 }}>
            <View style={styles.statInner}>
              {loanStats.outUSD > 0
                ? <Text style={[styles.statMain, { color: AMBER }, ff('400')]}>{fmtUSD(loanStats.outUSD)}</Text>
                : <Text style={[styles.statMain, { color: AMBER }, ff('400')]}>—</Text>
              }
              {loanStats.outKHR > 0 && <Text style={[styles.statSub, { color: AMBER + 'BB' }, ff('400')]}>{fmtKHR(loanStats.outKHR)}</Text>}
              <Text style={[styles.statLabel, { color: colors.textMuted }, ff('600')]}>{t.outstanding}</Text>
            </View>
          </GlassCard>

          <GlassCard style={{ flex: 1 }}>
            <View style={styles.statInner}>
              <Text style={[styles.statMain, { color: onTrackPct >= 80 ? GREEN : onTrackPct >= 60 ? AMBER : RED }, ff('400')]}>{onTrackPct}%</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }, ff('600')]}>{t.onTrack}</Text>
            </View>
          </GlassCard>
        </View>

        {/* ── 6. Overdue Alert ── */}
        {overdueCount > 0 && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => navLoanList('overdue')}>
            <View style={[styles.alertBanner, { backgroundColor: RED + '12', borderColor: RED + '30' }]}>
              <View style={[styles.alertPulse, { backgroundColor: RED }]} />
              <Text style={[styles.alertText, { color: RED }, ff('600')]}>
                {t.overdueAlert(overdueCount, loanStats.outUSD > 0 ? fmtUSD(loanStats.ovdUSD) : fmtKHR(loanStats.ovdKHR))}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={RED} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── 7. Portfolio ── */}
        {portfolioLoans.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('600')]}>{sectionUp(t.portfolio)}</Text>
            <GlassCard style={styles.card}>
              {portfolioLoans.map((loan, i) => {
                const isOvd = loan.status === 'overdue';
                const dotColor = isOvd ? RED : ACCENT;
                return (
                  <TouchableOpacity
                    key={loan.id}
                    style={[styles.loanRow, i < portfolioLoans.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                    onPress={() => navLoan(loan.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.loanAvatar, { backgroundColor: dotColor + '20' }]}>
                      <Text style={[styles.loanAvatarText, { color: dotColor }, ff('600')]}>
                        {(loan.borrowerName ?? '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.loanName, { color: colors.text }, ff('400')]} numberOfLines={1}>{loan.borrowerName}</Text>
                      <Text style={[styles.loanMeta, { color: colors.textMuted }, ff('400')]}>{formatCurrency(loan.currentPrincipal, loan.currency)} · {loan.interestRate}%</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: dotColor + '18' }]}>
                      <Text style={[styles.statusPillText, { color: dotColor }, ff('600')]}>{isOvd ? t.statusOverdue : t.statusActive}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </GlassCard>
          </>
        )}

        {/* ── 8. Recent Activity ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }, ff('600')]}>{sectionUp(t.recentActivity)}</Text>
        <GlassCard style={styles.card}>
          {paymentsLoading ? (
            <View style={{ paddingVertical: 8 }}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.actRow, i > 1 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <Skeleton width={34} height={34} radius={17} isDark={isDark} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="55%" height={13} isDark={isDark} />
                    <Skeleton width="35%" height={11} isDark={isDark} />
                  </View>
                  <Skeleton width={55} height={13} isDark={isDark} />
                </View>
              ))}
            </View>
          ) : recentPayments.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400')]}>{t.noActivity}</Text>
            </View>
          ) : (
            recentPayments.map((pay, i) => {
              const total = (pay.interestAmount ?? 0) + (pay.principalAmount ?? 0);
              return (
                <TouchableOpacity
                  key={pay.id}
                  style={[styles.actRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  onPress={() => navLoan(pay.loanId)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actIcon, { backgroundColor: GREEN + '18' }]}>
                    <Ionicons name="checkmark" size={15} color={GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actName, { color: colors.text }, ff('400')]} numberOfLines={1}>{pay.borrowerName ?? '—'}</Text>
                    <Text style={[styles.actDate, { color: colors.textMuted }, ff('400')]}>{pay.date ?? ''}</Text>
                  </View>
                  <Text style={[styles.actAmount, { color: GREEN }, ff('400')]}>+{formatCurrency(total, pay.loanCurrency ?? pay.currency)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </GlassCard>

        <View style={{ height: insets.bottom + 120 }} />
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

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (ff, fs) => StyleSheet.create({
  root:    { flex: 1 },
  header:  { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  greeting:{ fontSize: fs(13), lineHeight: 18 },
  navLogo: { height: 38, width: Math.round(38 * 256 / 144), marginTop: 2 },
  headerIcons: { flexDirection: 'row', gap: 8 },
  headerIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  // Generic
  card:        { marginBottom: 8 },
  cardInner:   { padding: 16 },
  sectionTitle:{ fontSize: fs(11), lineHeight: 15, marginTop: 20, marginBottom: 10, marginLeft: 2, letterSpacing: 0 },
  sectionLabel:{ fontSize: fs(12), lineHeight: 17, marginBottom: 4, letterSpacing: 0 },
  twoCol:      { flexDirection: 'row', gap: 12, marginBottom: 8 },

  // ── Health ────────────────────────────────────────────────────────────────
  healthTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  healthScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  healthNum:      { fontSize: fs(40), lineHeight: 46 },
  healthDenom:    { fontSize: fs(16), lineHeight: 22 },
  healthBadge:    { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
  healthBadgeText:{ fontSize: fs(13), lineHeight: 18 },
  track:     { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  trackFill: { height: '100%', borderRadius: 4 },
  healthDots:    { flexDirection: 'row', gap: 14 },
  healthDot:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:           { width: 7, height: 7, borderRadius: 3.5 },
  healthDotText: { fontSize: fs(12), lineHeight: 17 },

  // ── Income cards ──────────────────────────────────────────────────────────
  incomeInner:  { padding: 14, gap: 2 },
  incomeTag:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 6 },
  incomeTagText:{ fontSize: fs(10), lineHeight: 14 },
  incomeMain:   { fontSize: fs(22), lineHeight: 28 },
  incomeSub:    { fontSize: fs(13), lineHeight: 18, marginTop: 1 },
  changeRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  changeText:   { fontSize: fs(11), lineHeight: 15 },

  // ── Chart ─────────────────────────────────────────────────────────────────
  chartInner:       { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12 },
  chartSkeleton:    { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 },
  chartSkeletonBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barsArea:         { flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 4 },
  barGroup:         { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barCurLabel:      { fontSize: fs(9), lineHeight: 13, textAlign: 'center', marginBottom: 4 },
  barTrack:         { width: '100%', flex: 1, justifyContent: 'flex-end' },
  barFill:          { width: '80%', alignSelf: 'center', minHeight: 4 },
  barMonthLabel:    { fontSize: fs(11), lineHeight: 15, marginTop: 6, textAlign: 'center' },
  chartNote:        { fontSize: fs(11), lineHeight: 15, textAlign: 'center', marginTop: 10 },

  // ── Capital ───────────────────────────────────────────────────────────────
  capitalInner:   { paddingHorizontal: 16, paddingVertical: 14, gap: 0 },
  capitalItem:    { gap: 8 },
  capitalTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cBadge:         { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  cBadgeText:     { fontSize: fs(12), lineHeight: 17 },
  cPct:           { fontSize: fs(14), lineHeight: 19 },
  cAvail:         { fontSize: fs(12), lineHeight: 17, marginLeft: 'auto' },
  utilTrack:      { height: 8, borderRadius: 4, overflow: 'hidden' },
  utilFill:       { height: '100%', borderRadius: 4 },
  capitalSubRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  capitalSub:     { fontSize: fs(11), lineHeight: 15 },
  capDivider:     { height: StyleSheet.hairlineWidth, marginVertical: 14 },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow:   { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statInner:  { padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 72, gap: 4 },
  statMain:   { fontSize: fs(20), lineHeight: 26 },
  statSub:    { fontSize: fs(13), lineHeight: 18 },
  statLabel:  { fontSize: fs(11), lineHeight: 15, textAlign: 'center' },

  // ── Alert banner ──────────────────────────────────────────────────────────
  alertBanner:{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1, gap: 10, marginBottom: 4 },
  alertPulse: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  alertText:  { flex: 1, fontSize: fs(13), lineHeight: 18 },

  // ── Portfolio ─────────────────────────────────────────────────────────────
  loanRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  loanAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loanAvatarText: { fontSize: fs(15), lineHeight: 20 },
  loanName:       { fontSize: fs(14), lineHeight: 19, marginBottom: 2 },
  loanMeta:       { fontSize: fs(12), lineHeight: 17 },
  statusPill:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusPillText: { fontSize: fs(11), lineHeight: 15 },

  // ── Upcoming payments ─────────────────────────────────────────────────────
  upRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  upDot:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  upDotInner: { width: 9, height: 9, borderRadius: 4.5 },
  upName:     { fontSize: fs(14), lineHeight: 19, marginBottom: 2 },
  upDate:     { fontSize: fs(12), lineHeight: 17 },
  upRight:    { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  upAmount:   { fontSize: fs(14), lineHeight: 19 },
  upChip:     { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  upChipText: { fontSize: fs(10), lineHeight: 14 },

  // ── Recent activity ───────────────────────────────────────────────────────
  actRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  actIcon:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actName:   { fontSize: fs(14), lineHeight: 19, marginBottom: 2 },
  actDate:   { fontSize: fs(12), lineHeight: 17 },
  actAmount: { fontSize: fs(14), lineHeight: 19 },
  emptyRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  emptyText: { fontSize: fs(13), lineHeight: 18 },

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default DashboardScreen;
