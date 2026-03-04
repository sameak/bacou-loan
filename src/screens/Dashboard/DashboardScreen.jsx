/**
 * DASHBOARD SCREEN — Redesigned v4
 *
 * Layout:
 *   Header    — greeting + logo + icons
 *   Stats row — 3 compact cards: Active · Outstanding · On Track
 *   Month     — interest + principal (split inside one card)
 *   Alert     — overdue banner (conditional)
 *   Upcoming  — next payments per fixed loan
 *   Chart     — 6-month interest bars
 *   Capital   — utilization bars (conditional)
 *   Portfolio — top active/overdue loans
 *   Activity  — recent payments
 *   FAB       — create loan
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useTabBarScroll, useTabBar } from '../../context/TabBarContext';
import {
  DeviceEventEmitter,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const NAVBAR_LOGO      = require('../../../assets/images/navbar-logo.png');
const NAVBAR_LOGO_DARK = require('../../../assets/images/navbar-logo-dark.png');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { getBorrowerPayments, formatCurrency } from '../../services/loanService';
import { listenCapital } from '../../services/capitalService';
import { listenChats } from '../../services/chatService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import { Skeleton } from '../../components/Skeleton';

const ACCENT = '#00C2B2';
const GREEN  = '#10B981';
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

function monthKey(offset = 0) {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
}

const T = {
  en: {
    morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
    thisMonth: 'This Month',
    interest: 'Interest Earned', principal: 'Principal Collected',
    vsLastMonth: 'vs last month', newEarning: 'First earnings',
    chart6m: '6-Month Interest', khrNote: '+ KHR interest in Reports',
    myCapital: 'Capital', available: 'free',
    lent: 'Lent', total: 'Total',
    active: 'Active', onTrack: 'On Track', outstanding: 'Outstanding',
    overdueAlert: (n, amt) => `${n} loan${n > 1 ? 's' : ''} overdue · ${amt} at risk`,
    portfolio: 'Top Loans',
    recentActivity: 'Recent Activity', noActivity: 'No payments recorded yet',
    statusActive: 'Active', statusOverdue: 'Overdue',
    upcomingPayments: 'Upcoming Payments',
    allOnTrack: 'All payments on track',
    today: 'Today',
    inDays: n => `in ${n}d`,
    overdueDays: n => `${n}d overdue`,
    chartMonths: ['J','F','M','A','M','J','J','A','S','O','N','D'],
  },
  km: {
    morning: 'អរុណសួស្ដី', afternoon: 'ទិវាសួស្ដី', evening: 'សាយ័ណ្ហសួស្ដី',
    thisMonth: 'ខែនេះ',
    interest: 'ការប្រាក់', principal: 'ដើមទុន',
    vsLastMonth: 'ធៀបខែមុន', newEarning: 'ដំបូង',
    chart6m: 'ការប្រាក់ ៦ ខែ', khrNote: '+ ការប្រាក់រៀលក្នុងរបាយការណ៍',
    myCapital: 'ដើមទុន', available: 'នៅសល់',
    lent: 'បានផ្ដល់', total: 'សរុប',
    active: 'កម្ចីសរុប', onTrack: 'ទៀងទាត់', outstanding: 'ដែលបានផ្តល់',
    overdueAlert: (n, amt) => `${n} ហួសកំណត់ · ${amt} ប្រយ័ត្ន`,
    portfolio: 'បញ្ជីប្រាក់កម្ចី',
    recentActivity: 'សកម្មភាពថ្មីៗ', noActivity: 'មិនទាន់មានការបង់',
    statusActive: 'ដំណើរការ', statusOverdue: 'ហួសកំណត់',
    upcomingPayments: 'ការទូទាត់ខាងមុខ',
    allOnTrack: 'ការទូទាត់ទាំងអស់ទន្ទ្រាន',
    today: 'ថ្ងៃនេះ',
    inDays: n => `${n} ថ្ងៃ`,
    overdueDays: n => `ហួស ${n} ថ្ងៃ`,
    chartMonths: ['១','២','៣','៤','៥','៦','៧','៨','៩','១០','១១','១២'],
  },
};

// ── Screen ──────────────────────────────────────────────────────────────────────
const DashboardScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const isKhmer = language === 'km';
  const styles = useMemo(() => makeStyles(ff, fs, isKhmer), [ff, fs, isKhmer]);
  const scrollHandler = useTabBarScroll();
  const { tabVisible } = useTabBar();
  const scrollRef = useRef(null);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tabBarScrollToTop', ({ index }) => {
      if (index === 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => sub.remove();
  }, []);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabVisible ? (1 - tabVisible.value) * 100 : 0 }],
  }));
  const headerH = useSharedValue(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabVisible ? (1 - tabVisible.value) * -headerH.value : 0 }],
  }));

  const { loans, loansLoaded } = useData();
  const [capital, setCapital]         = useState({ capitalUSD: 0, capitalKHR: 0 });
  const [payments, setPayments]       = useState([]);
  const [paymentsLoading, setLoading] = useState(true);
  const [upcoming, setUpcoming]       = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => listenCapital(setCapital), []);

  useEffect(() => {
    return listenChats(chats => {
      const myUid = auth.currentUser?.uid;
      const sum = chats.reduce((acc, c) => acc + (c.unreadCounts?.[myUid] ?? 0), 0);
      setTotalUnread(sum);
    });
  }, []);

  useEffect(() => {
    if (!loansLoaded) return;
    getBorrowerPayments(loans)
      .then(p => { setPayments(p); setLoading(false); })
      .catch(() => setLoading(false));

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
      setUpcoming(rows.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 5));
    });
  }, [loansLoaded]);

  const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtKHR = n => '៛' + Math.round(n).toLocaleString();

  const navLoan     = id => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanDetail', params: { loanId: id } } });
  const navLoanList = f  => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanList',   params: { initialFilter: f } } });

  const loanStats = useMemo(() => {
    const open       = loans.filter(l => l.status !== 'paid' && l.status !== 'written_off');
    const active     = loans.filter(l => l.status === 'active');
    const overdue    = loans.filter(l => l.status === 'overdue');
    const writtenOff = loans.filter(l => l.status === 'written_off');
    const sum = (arr, key) => arr.reduce((s, l) => s + (l[key] ?? 0), 0);
    const outUSD = sum(open.filter(l => l.currency === 'USD'), 'currentPrincipal');
    const outKHR = sum(open.filter(l => l.currency === 'KHR'), 'currentPrincipal');
    const ovdUSD = sum(overdue.filter(l => l.currency === 'USD'), 'currentPrincipal');
    const ovdKHR = sum(overdue.filter(l => l.currency === 'KHR'), 'currentPrincipal');
    const totalOpen  = active.length + overdue.length;
    const onTrackPct = totalOpen > 0 ? Math.round((active.length / totalOpen) * 100) : 100;
    const overduePct = totalOpen > 0 ? overdue.length / totalOpen : 0;
    const health     = Math.max(0, Math.min(100, Math.round(100 - overduePct * 60 - (writtenOff.length > 0 ? 5 : 0))));
    return { activeCount: active.length, overdueCount: overdue.length, totalOpen, outUSD, outKHR, ovdUSD, ovdKHR, onTrackPct, health };
  }, [loans]);

  const incomeData = useMemo(() => {
    const thisM = monthKey(0);
    const lastM = monthKey(-1);
    let tiUSD = 0, tiKHR = 0, tpUSD = 0, tpKHR = 0, liUSD = 0;
    for (const p of payments) {
      const m = p.date?.slice(0, 7);
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

  const chartData = useMemo(() => {
    const keys = Array.from({ length: 6 }, (_, i) => monthKey(i - 5));
    const data = keys.map(mk => {
      const ps  = payments.filter(p => p.date?.slice(0, 7) === mk);
      const usd = ps.filter(p => (p.loanCurrency ?? p.currency) !== 'KHR').reduce((s, p) => s + (p.interestAmount ?? 0), 0);
      const khr = ps.filter(p => (p.loanCurrency ?? p.currency) === 'KHR').reduce((s, p) => s + (p.interestAmount ?? 0), 0);
      const [, m] = mk.split('-').map(Number);
      return { key: mk, usd, khr, mIdx: m - 1 };
    });
    const maxUSD = Math.max(...data.map(d => d.usd), 1);
    const hasKHR = data.some(d => d.khr > 0);
    return { data, maxUSD, hasKHR };
  }, [payments]);

  const capitalUtil = useMemo(() => ({
    usdPct: capital.capitalUSD > 0 ? Math.min(100, Math.round((loanStats.outUSD / capital.capitalUSD) * 100)) : 0,
    khrPct: capital.capitalKHR > 0 ? Math.min(100, Math.round((loanStats.outKHR / capital.capitalKHR) * 100)) : 0,
  }), [capital, loanStats]);

  const portfolioLoans = useMemo(() =>
    loans.filter(l => l.status === 'active' || l.status === 'overdue')
         .sort((a, b) => (b.currentPrincipal ?? 0) - (a.currentPrincipal ?? 0))
         .slice(0, 5),
    [loans],
  );

  const recentPayments = useMemo(() => payments.slice(0, 5), [payments]);

  const hasCapital   = capital.capitalUSD > 0 || capital.capitalKHR > 0;
  const { onTrackPct, overdueCount, activeCount } = loanStats;
  const onTrackColor = onTrackPct >= 80 ? GREEN : onTrackPct >= 60 ? AMBER : RED;
  const hour         = new Date().getHours();
  const greetKey     = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const userName     = auth.currentUser?.displayName?.split(' ')[0] ?? '';
  const thisMonthKey = monthKey(0);
  const todayStr     = new Date().toISOString().slice(0, 10);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>

      {/* ── Header ── */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: isDark ? colors.background : '#EBEBEB' }, headerAnimStyle]} onLayout={(e) => { const h = e.nativeEvent.layout.height; headerH.value = h; setHeaderHeight(h); }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textMuted }, ff('400')]}>{t[greetKey]}{userName ? `, ${userName}` : ''}</Text>
            <Image source={isDark ? NAVBAR_LOGO_DARK : NAVBAR_LOGO} style={styles.navLogo} resizeMode="contain" />
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
              onPress={() => navigation.navigate('ChatList')}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
              {totalUnread > 0 && (
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, ff('700')]}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
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
      </Animated.View>

      <Animated.ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: headerHeight + 4 }]} onScroll={scrollHandler} scrollEventThrottle={16}>

        {/* ── 1. Stats row ── */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <View style={styles.statInner}>
              <Text style={[styles.statVal, { color: ACCENT }, ff('700')]}>{activeCount + overdueCount}</Text>
              <Text style={[styles.statLbl, { color: colors.textMuted }, ff('400')]}>{t.active}</Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={styles.statInner}>
              <Text style={[styles.statVal, { color: AMBER }, ff('700')]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                {loanStats.outUSD > 0 ? fmtUSD(loanStats.outUSD) : loanStats.outKHR > 0 ? fmtKHR(loanStats.outKHR) : '—'}
              </Text>
              {loanStats.outUSD > 0 && loanStats.outKHR > 0 && (
                <Text style={[styles.statSub, { color: AMBER + 'AA' }, ff('400')]} numberOfLines={1}>{fmtKHR(loanStats.outKHR)}</Text>
              )}
              <Text style={[styles.statLbl, { color: colors.textMuted }, ff('400')]}>{t.outstanding}</Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={styles.statInner}>
              <Text style={[styles.statVal, { color: onTrackColor }, ff('700')]}>{onTrackPct}%</Text>
              <Text style={[styles.statLbl, { color: colors.textMuted }, ff('400')]}>{t.onTrack}</Text>
            </View>
          </GlassCard>
        </View>

        {/* ── 2. This Month ── */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }, ff('700')]}>{t.thisMonth.toUpperCase()}</Text>
          <View style={styles.twoCol}>
            <View style={styles.incomeCell}>
              <View style={[styles.incomeIconWrap, { backgroundColor: ACCENT + '18' }]}>
                <Ionicons name="trending-up-outline" size={15} color={ACCENT} />
              </View>
              <Text style={[styles.incomeTitle, { color: colors.textMuted }, ff('400')]}>{t.interest}</Text>
              {paymentsLoading ? (
                <Skeleton width="80%" height={22} isDark={isDark} style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={[styles.incomeVal, { color: ACCENT }, ff('700')]}>{fmtUSD(incomeData.tiUSD)}</Text>
                  {incomeData.tiKHR > 0 && <Text style={[styles.incomeSub, { color: ACCENT + 'AA' }, ff('400')]}>{fmtKHR(incomeData.tiKHR)}</Text>}
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

            <View style={[styles.colDivider, { backgroundColor: colors.border }]} />

            <View style={styles.incomeCell}>
              <View style={[styles.incomeIconWrap, { backgroundColor: GREEN + '18' }]}>
                <Ionicons name="cash-outline" size={15} color={GREEN} />
              </View>
              <Text style={[styles.incomeTitle, { color: colors.textMuted }, ff('400')]}>{t.principal}</Text>
              {paymentsLoading ? (
                <Skeleton width="80%" height={22} isDark={isDark} style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={[styles.incomeVal, { color: GREEN }, ff('700')]}>{fmtUSD(incomeData.tpUSD)}</Text>
                  {incomeData.tpKHR > 0 && <Text style={[styles.incomeSub, { color: GREEN + 'AA' }, ff('400')]}>{fmtKHR(incomeData.tpKHR)}</Text>}
                  <Text style={[styles.changeText, { color: colors.textMuted }, ff('400')]}>{t.thisMonth}</Text>
                </>
              )}
            </View>
          </View>
        </GlassCard>

        {/* ── 3. Overdue Alert ── */}
        {overdueCount > 0 && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => navLoanList('overdue')} style={styles.card}>
            <View style={[styles.alertBanner, { backgroundColor: RED + '12', borderColor: RED + '30' }]}>
              <View style={[styles.alertDot, { backgroundColor: RED }]} />
              <Text style={[styles.alertText, { color: RED }, ff('600')]}>
                {t.overdueAlert(overdueCount, loanStats.outUSD > 0 ? fmtUSD(loanStats.ovdUSD) : fmtKHR(loanStats.ovdKHR))}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={RED} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── 4. Upcoming Payments ── */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }, ff('700')]}>{t.upcomingPayments.toUpperCase()}</Text>
          {upcoming.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={GREEN} />
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400')]}>{t.allOnTrack}</Text>
            </View>
          ) : (
            upcoming.map((item, i) => {
              const diffDays  = Math.round((new Date(item.dueDate) - new Date(todayStr)) / 86400000);
              const isOverdue = diffDays < 0;
              const isToday   = diffDays === 0;
              const rowColor  = isOverdue ? RED : isToday ? AMBER : ACCENT;
              const chipLabel = isOverdue ? t.overdueDays(Math.abs(diffDays)) : isToday ? t.today : t.inDays(diffDays);
              const fmtAmt    = item.currency === 'KHR' ? fmtKHR(item.totalDue ?? 0) : fmtUSD(item.totalDue ?? 0);
              return (
                <TouchableOpacity
                  key={`${item.loanId}-${item.dueDate}-${i}`}
                  style={[styles.listRow, i < upcoming.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => navLoan(item.loanId)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dotWrap, { backgroundColor: rowColor + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: rowColor }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.text }, ff('600')]} numberOfLines={1}>{item.borrowerName}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }, ff('400')]}>{item.dueDate}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowAmt, { color: colors.text }, ff('700')]}>{fmtAmt}</Text>
                    <View style={[styles.chip, { backgroundColor: rowColor + '18' }]}>
                      <Text style={[styles.chipText, { color: rowColor }, ff('600')]}>{chipLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </GlassCard>

        {/* ── 5. 6-Month Chart ── */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }, ff('700')]}>{t.chart6m.toUpperCase()}</Text>
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
                  {chartData.data.map(d => {
                    const pct       = Math.max(4, Math.round((d.usd / chartData.maxUSD) * 100));
                    const isCurrent = d.key === thisMonthKey;
                    const barColor  = isCurrent ? ACCENT : ACCENT + '45';
                    return (
                      <View key={d.key} style={styles.barGroup}>
                        {isCurrent && d.usd > 0 && (
                          <Text style={[styles.barCurLabel, { color: ACCENT }, ff('600')]}>{fmtUSD(d.usd)}</Text>
                        )}
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { height: `${pct}%`, backgroundColor: barColor, borderRadius: isCurrent ? 6 : 4 }]} />
                        </View>
                        <Text style={[styles.barMonthLabel, { color: isCurrent ? colors.text : colors.textMuted }, ff(isCurrent ? '700' : '400')]}>
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

        {/* ── 6. Capital Utilization ── */}
        {hasCapital && (
          <GlassCard style={styles.card}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }, ff('700')]}>{t.myCapital.toUpperCase()}</Text>
            <View style={styles.capitalInner}>
              {capital.capitalUSD > 0 && (
                <View style={styles.capitalItem}>
                  <View style={styles.capitalTopRow}>
                    <View style={[styles.cBadge, { backgroundColor: ACCENT + '18' }]}>
                      <Text style={[styles.cBadgeText, { color: ACCENT }, ff('700')]}>🇺🇸 USD</Text>
                    </View>
                    <Text style={[styles.cPct, { color: colors.text }, ff('600')]}>{capitalUtil.usdPct}%</Text>
                    <Text style={[styles.cAvail, { color: colors.textMuted }, ff('400')]}>{fmtUSD(capital.capitalUSD - loanStats.outUSD)} {t.available}</Text>
                  </View>
                  <View style={[styles.utilTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}>
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
                      <Text style={[styles.cBadgeText, { color: AMBER }, ff('700')]}>🇰🇭 KHR</Text>
                    </View>
                    <Text style={[styles.cPct, { color: colors.text }, ff('600')]}>{capitalUtil.khrPct}%</Text>
                    <Text style={[styles.cAvail, { color: colors.textMuted }, ff('400')]}>{fmtKHR(capital.capitalKHR - loanStats.outKHR)} {t.available}</Text>
                  </View>
                  <View style={[styles.utilTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}>
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
        )}

        {/* ── 7. Portfolio ── */}
        {portfolioLoans.length > 0 && (
          <GlassCard style={styles.card}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }, ff('700')]}>{t.portfolio.toUpperCase()}</Text>
            {portfolioLoans.map((loan, i) => {
              const isOvd    = loan.status === 'overdue';
              const dotColor = isOvd ? RED : ACCENT;
              return (
                <TouchableOpacity
                  key={loan.id}
                  style={[styles.listRow, i < portfolioLoans.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => navLoan(loan.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.avatar, { backgroundColor: dotColor + '20' }]}>
                    <Text style={[styles.avatarText, { color: dotColor }, ff('700')]}>
                      {(loan.borrowerName ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.text }, ff('600')]} numberOfLines={1}>{loan.borrowerName}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }, ff('400')]}>{formatCurrency(loan.currentPrincipal, loan.currency)} · {loan.interestRate}%</Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: dotColor + '18' }]}>
                    <Text style={[styles.chipText, { color: dotColor }, ff('600')]}>{isOvd ? t.statusOverdue : t.statusActive}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        )}

        {/* ── 8. Recent Activity ── */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }, ff('700')]}>{t.recentActivity.toUpperCase()}</Text>
          {paymentsLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.listRow, i > 1 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <Skeleton width={36} height={36} radius={18} isDark={isDark} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="55%" height={13} isDark={isDark} />
                    <Skeleton width="35%" height={11} isDark={isDark} />
                  </View>
                  <Skeleton width={60} height={13} isDark={isDark} />
                </View>
              ))}
            </>
          ) : recentPayments.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('400')]}>{t.noActivity}</Text>
            </View>
          ) : (
            recentPayments.map((pay, i) => {
              const total = (pay.interestAmount ?? 0) + (pay.principalAmount ?? 0);
              return (
                <TouchableOpacity
                  key={pay.id}
                  style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  onPress={() => navLoan(pay.loanId)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actIcon, { backgroundColor: GREEN + '18' }]}>
                    <Ionicons name="checkmark" size={15} color={GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.text }, ff('600')]} numberOfLines={1}>{pay.borrowerName ?? '—'}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }, ff('400')]}>{pay.date ?? ''}</Text>
                  </View>
                  <Text style={[styles.rowAmt, { color: GREEN }, ff('700')]}>+{formatCurrency(total, pay.loanCurrency ?? pay.currency)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </GlassCard>

        <View style={{ height: insets.bottom + 120 }} />
      </Animated.ScrollView>

      {/* ── FAB ── */}
      <AnimatedTouchable
        style={[styles.fab, { bottom: insets.bottom + 100 }, fabAnimStyle]}
        onPress={() => navigation.navigate('CreateLoan')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </AnimatedTouchable>
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────────
const makeStyles = (ff, fs, km) => StyleSheet.create({
  root:        { flex: 1 },
  header:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  greeting:    { fontSize: km ? fs(14) : fs(13), lineHeight: km ? 19 : 18, letterSpacing: 0 },
  navLogo:     { height: 38, width: Math.round(38 * 256 / 144), marginTop: 2, alignSelf: 'flex-start' },
  headerIcons: { flexDirection: 'row', gap: 8 },
  headerIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge:       { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:   { color: '#fff', fontSize: 10, lineHeight: 14, letterSpacing: 0 },
  content:     { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  // ── Card base ────────────────────────────────────────────────────────────────
  card:      { marginTop: 12 },
  cardLabel: { fontSize: km ? fs(11) : fs(10), lineHeight: km ? 15 : 14, letterSpacing: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },

  // ── Stats row ────────────────────────────────────────────────────────────────
  statsRow:  { flexDirection: 'row', gap: 10 },
  statCard:  { flex: 1 },
  statInner: { paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  statVal:   { fontSize: km ? fs(22) : fs(20), lineHeight: km ? 28 : 26, letterSpacing: 0 },
  statSub:   { fontSize: km ? fs(11) : fs(10), lineHeight: km ? 15 : 14, letterSpacing: 0 },
  statLbl:   { fontSize: km ? fs(11) : fs(10), lineHeight: km ? 15 : 14, letterSpacing: 0, textAlign: 'center' },

  // ── This Month ───────────────────────────────────────────────────────────────
  twoCol:        { flexDirection: 'row' },
  incomeCell:    { flex: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 3 },
  colDivider:    { width: StyleSheet.hairlineWidth, marginBottom: 16 },
  incomeIconWrap:{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  incomeTitle:   { fontSize: km ? fs(12) : fs(11), lineHeight: km ? 17 : 15, letterSpacing: 0 },
  incomeVal:     { fontSize: km ? fs(22) : fs(20), lineHeight: km ? 28 : 26, letterSpacing: 0 },
  incomeSub:     { fontSize: km ? fs(12) : fs(11), lineHeight: km ? 17 : 15, letterSpacing: 0 },
  changeRow:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  changeText:    { fontSize: km ? fs(12) : fs(11), lineHeight: km ? 17 : 15, letterSpacing: 0 },

  // ── Alert ────────────────────────────────────────────────────────────────────
  alertBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, gap: 10 },
  alertDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  alertText:   { flex: 1, fontSize: km ? fs(14) : fs(13), lineHeight: km ? 19 : 18, letterSpacing: 0 },

  // ── Shared list rows ─────────────────────────────────────────────────────────
  listRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowName:   { fontSize: fs(14), lineHeight: 19, letterSpacing: 0, marginBottom: 2 },
  rowMeta:   { fontSize: km ? fs(13) : fs(12), lineHeight: km ? 18 : 17, letterSpacing: 0 },
  rowRight:  { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  rowAmt:    { fontSize: km ? fs(15) : fs(14), lineHeight: km ? 20 : 19, letterSpacing: 0 },
  chip:      { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  chipText:  { fontSize: km ? fs(11) : fs(10), lineHeight: km ? 15 : 14, letterSpacing: 0 },
  dotWrap:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dot:       { width: 7, height: 7, borderRadius: 3.5 },
  avatar:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: km ? fs(15) : fs(14), lineHeight: km ? 20 : 19, letterSpacing: 0 },
  actIcon:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'center' },
  emptyText: { fontSize: km ? fs(14) : fs(13), lineHeight: km ? 19 : 18, letterSpacing: 0 },

  // ── Chart ────────────────────────────────────────────────────────────────────
  chartInner:          { paddingHorizontal: 14, paddingBottom: 14 },
  chartSkeleton:       { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 },
  chartSkeletonBarWrap:{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barsArea:            { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barGroup:            { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barCurLabel:         { fontSize: km ? fs(10) : fs(9), lineHeight: km ? 14 : 13, textAlign: 'center', marginBottom: 4, letterSpacing: 0 },
  barTrack:            { width: '100%', flex: 1, justifyContent: 'flex-end' },
  barFill:             { width: '78%', alignSelf: 'center', minHeight: 4 },
  barMonthLabel:       { fontSize: km ? fs(12) : fs(11), lineHeight: km ? 17 : 15, marginTop: 6, textAlign: 'center', letterSpacing: 0 },
  chartNote:           { fontSize: km ? fs(12) : fs(11), lineHeight: km ? 17 : 15, textAlign: 'center', marginTop: 10, letterSpacing: 0 },

  // ── Capital ──────────────────────────────────────────────────────────────────
  capitalInner:  { paddingHorizontal: 16, paddingBottom: 16 },
  capitalItem:   { gap: 10 },
  capitalTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cBadge:        { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  cBadgeText:    { fontSize: km ? fs(13) : fs(12), lineHeight: km ? 18 : 17, letterSpacing: 0 },
  cPct:          { fontSize: km ? fs(15) : fs(14), lineHeight: km ? 20 : 19, letterSpacing: 0 },
  cAvail:        { fontSize: km ? fs(13) : fs(12), lineHeight: km ? 18 : 17, letterSpacing: 0, marginLeft: 'auto' },
  utilTrack:     { height: 6, borderRadius: 3, overflow: 'hidden' },
  utilFill:      { height: '100%', borderRadius: 3 },
  capitalSubRow: { flexDirection: 'row', justifyContent: 'space-between' },
  capitalSub:    { fontSize: km ? fs(12) : fs(11), lineHeight: km ? 17 : 15, letterSpacing: 0 },
  capDivider:    { height: StyleSheet.hairlineWidth, marginVertical: 14 },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default DashboardScreen;
