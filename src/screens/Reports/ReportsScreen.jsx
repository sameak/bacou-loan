/**
 * REPORTS SCREEN — Profit & Loss
 * Monthly breakdown of interest earned and principal collected,
 * split by currency (USD / KHR). Data loaded from all loan payments.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBorrowerPayments } from '../../services/loanService';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';

const ACCENT = '#6366F1';

const T = {
  en: {
    title: 'Reports',
    interestEarned: 'Interest Earned',
    principalCollected: 'Principal Collected',
    allTime: 'All time',
    payments: 'payments',
    payment: 'payment',
    noData: 'No payment records yet',
    totalInterest: 'Total Interest',
    totalPrincipal: 'Total Principal',
    loading: 'Loading payments...',
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  },
  km: {
    title: 'របាយការណ៍',
    interestEarned: 'ការប្រាក់ទទួលបាន',
    principalCollected: 'ដើមទុនទទួល',
    allTime: 'ទាំងអស់',
    payments: 'ការបង់',
    payment: 'ការបង់',
    noData: 'មិនទាន់មានការបង់',
    totalInterest: 'ការប្រាក់សរុប',
    totalPrincipal: 'ដើមទុនសរុប',
    loading: 'កំពុងផ្ទុក...',
    months: ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'],
  },
};

const ReportsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff, fs), [ff, fs]);

  const { loans, loansLoaded } = useData();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loansLoaded) return;
    setLoading(true);
    getBorrowerPayments(loans)
      .then(p => { setPayments(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [loansLoaded]);

  const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const fmtKHR = (n) => '៛' + Math.round(n).toLocaleString();

  const monthLabel = (key) => {
    const [year, month] = key.split('-').map(Number);
    return `${t.months[month - 1]} ${year}`;
  };

  // Group payments by month, split by currency
  const { monthGroups, summary } = useMemo(() => {
    const groups = {};
    let totalInterestUSD = 0, totalInterestKHR = 0;
    let totalPrincipalUSD = 0, totalPrincipalKHR = 0;

    for (const pay of payments) {
      if (!pay.date) continue;
      const monthKey = pay.date.slice(0, 7); // 'YYYY-MM'
      const isKHR = (pay.loanCurrency ?? pay.currency) === 'KHR';

      if (!groups[monthKey]) {
        groups[monthKey] = {
          key: monthKey,
          usdInterest: 0, usdPrincipal: 0, usdCount: 0,
          khrInterest: 0, khrPrincipal: 0, khrCount: 0,
        };
      }

      const g = groups[monthKey];
      if (isKHR) {
        g.khrInterest  += pay.interestAmount  ?? 0;
        g.khrPrincipal += pay.principalAmount ?? 0;
        g.khrCount++;
        totalInterestKHR  += pay.interestAmount  ?? 0;
        totalPrincipalKHR += pay.principalAmount ?? 0;
      } else {
        g.usdInterest  += pay.interestAmount  ?? 0;
        g.usdPrincipal += pay.principalAmount ?? 0;
        g.usdCount++;
        totalInterestUSD  += pay.interestAmount  ?? 0;
        totalPrincipalUSD += pay.principalAmount ?? 0;
      }
    }

    const sorted = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    return {
      monthGroups: sorted,
      summary: { totalInterestUSD, totalInterestKHR, totalPrincipalUSD, totalPrincipalKHR },
    };
  }, [payments]);

  const { totalInterestUSD, totalInterestKHR, totalPrincipalUSD, totalPrincipalKHR } = summary;
  const hasUSD = totalInterestUSD > 0 || totalPrincipalUSD > 0;
  const hasKHR = totalInterestKHR > 0 || totalPrincipalKHR > 0;

  const renderMonth = ({ item: g }) => {
    const hasMonthUSD = g.usdCount > 0;
    const hasMonthKHR = g.khrCount > 0;
    const count = g.usdCount + g.khrCount;
    return (
      <GlassCard style={styles.monthCard}>
        <View style={styles.monthCardInner}>
          {/* Month header */}
          <View style={styles.monthHeader}>
            <Text style={[styles.monthLabel, { color: colors.text }, ff('700')]}>{monthLabel(g.key)}</Text>
            <View style={[styles.countPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.countText, { color: colors.textMuted }, ff('500')]}>
                {count} {count === 1 ? t.payment : t.payments}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Interest row */}
          <View style={styles.metricRow}>
            <View style={[styles.metricDot, { backgroundColor: ACCENT }]} />
            <Text style={[styles.metricLabel, { color: colors.textMuted }, ff('500')]}>{t.interestEarned}</Text>
            <View style={styles.metricVals}>
              {hasMonthUSD && (
                <Text style={[styles.metricVal, { color: ACCENT }, ff('700')]}>{fmtUSD(g.usdInterest)}</Text>
              )}
              {hasMonthKHR && (
                <Text style={[styles.metricVal, { color: ACCENT + 'CC' }, ff('600')]}>{fmtKHR(g.khrInterest)}</Text>
              )}
            </View>
          </View>

          {/* Principal row */}
          <View style={[styles.metricRow, { marginBottom: 0 }]}>
            <View style={[styles.metricDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.metricLabel, { color: colors.textMuted }, ff('500')]}>{t.principalCollected}</Text>
            <View style={styles.metricVals}>
              {hasMonthUSD && (
                <Text style={[styles.metricVal, { color: '#10B981' }, ff('700')]}>{fmtUSD(g.usdPrincipal)}</Text>
              )}
              {hasMonthKHR && (
                <Text style={[styles.metricVal, { color: '#10B981BB' }, ff('600')]}>{fmtKHR(g.khrPrincipal)}</Text>
              )}
            </View>
          </View>
        </View>
      </GlassCard>
    );
  };

  const ListHeader = () => (
    <View style={styles.summaryRow}>
      {/* Total Interest card */}
      <GlassCard style={styles.summaryCard}>
        <View style={styles.summaryCardInner}>
          <View style={[styles.summaryTag, { backgroundColor: ACCENT + '20' }]}>
            <Ionicons name="trending-up-outline" size={13} color={ACCENT} />
            <Text style={[styles.summaryTagText, { color: ACCENT }, ff('600')]}>{t.totalInterest}</Text>
          </View>
          {hasUSD && (
            <Text style={[styles.summaryMain, { color: ACCENT }, ff('800')]}>{fmtUSD(totalInterestUSD)}</Text>
          )}
          {hasKHR && (
            <Text style={[styles.summarySecond, { color: ACCENT + 'BB' }, ff('700')]}>{fmtKHR(totalInterestKHR)}</Text>
          )}
          {!hasUSD && !hasKHR && (
            <Text style={[styles.summaryMain, { color: ACCENT }, ff('800')]}>—</Text>
          )}
          <Text style={[styles.summaryHint, { color: colors.textMuted }, ff('400')]}>{t.allTime}</Text>
        </View>
      </GlassCard>

      {/* Total Principal card */}
      <GlassCard style={styles.summaryCard}>
        <View style={styles.summaryCardInner}>
          <View style={[styles.summaryTag, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="cash-outline" size={13} color="#10B981" />
            <Text style={[styles.summaryTagText, { color: '#10B981' }, ff('600')]}>{t.totalPrincipal}</Text>
          </View>
          {hasUSD && (
            <Text style={[styles.summaryMain, { color: '#10B981' }, ff('800')]}>{fmtUSD(totalPrincipalUSD)}</Text>
          )}
          {hasKHR && (
            <Text style={[styles.summarySecond, { color: '#10B981BB' }, ff('700')]}>{fmtKHR(totalPrincipalKHR)}</Text>
          )}
          {!hasUSD && !hasKHR && (
            <Text style={[styles.summaryMain, { color: '#10B981' }, ff('800')]}>—</Text>
          )}
          <Text style={[styles.summaryHint, { color: colors.textMuted }, ff('400')]}>{t.allTime}</Text>
        </View>
      </GlassCard>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }, ff('700')]}>{t.title}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }, ff('400')]}>{t.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={monthGroups}
          keyExtractor={g => g.key}
          renderItem={renderMonth}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Ionicons name="bar-chart-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }, ff('500')]}>{t.noData}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const makeStyles = (ff, fs) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: 'center', paddingVertical: 4 },
  headerTitle: { fontSize: fs(18), lineHeight: 24 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: fs(14), lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  summaryCard: { flex: 1 },
  summaryCardInner: { padding: 14, gap: 3 },
  summaryTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  summaryTagText: { fontSize: fs(11), lineHeight: 15 },
  summaryMain: { fontSize: fs(18), lineHeight: 24 },
  summarySecond: { fontSize: fs(13), lineHeight: 18 },
  summaryHint: { fontSize: fs(11), lineHeight: 15, marginTop: 4 },
  monthCard: { marginBottom: 12 },
  monthCardInner: { paddingHorizontal: 16, paddingVertical: 14 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthLabel: { fontSize: fs(15), lineHeight: 20, flexShrink: 1, marginRight: 8 },
  countPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  countText: { fontSize: fs(12), lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  metricDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  metricLabel: { flex: 1, fontSize: fs(13), lineHeight: 18 },
  metricVals: { alignItems: 'flex-end', gap: 2, flexShrink: 0, minWidth: 80 },
  metricVal: { fontSize: fs(13), lineHeight: 18 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 80 },
  emptyText: { fontSize: fs(15), lineHeight: 20 },
});

export default ReportsScreen;
