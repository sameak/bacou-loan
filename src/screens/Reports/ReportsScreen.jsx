/**
 * REPORTS SCREEN — Comprehensive financial dashboard
 * Year-filterable overview + monthly cash flow breakdown with capital deployment tracking.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBorrowerPayments } from '../../services/loanService';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';

const ACCENT = '#00C2B2';
const GREEN  = '#10B981';
const TEAL   = '#06B6D4';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

const T = {
  en: {
    title: 'Reports',
    allTime: 'All time',
    export: 'Export PDF',
    exportError: 'Export failed',
    exportTitle: 'Loan Report',
    generated: 'Generated',
    period: 'Period',
    outstanding: 'Outstanding Capital',
    activeLoans: 'Active Loans',
    overdue: 'overdue',
    interestEarned: 'Interest Earned',
    totalReceived: 'Total Received',
    interest: 'Interest',
    principalIn: 'Principal In',
    capitalOut: 'Capital Out',
    netFlow: 'Net Flow',
    newLoan: 'new loan',
    newLoans: 'new loans',
    payments: 'payments',
    payment: 'payment',
    noData: 'No records yet',
    loading: 'Loading payments...',
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  },
  km: {
    title: 'របាយការណ៍',
    allTime: 'ទាំងអស់',
    export: 'នាំចេញ PDF',
    exportError: 'បរាជ័យក្នុងការនាំចេញ',
    exportTitle: 'របាយការណ៍ប្រាក់កម្ចី',
    generated: 'បង្កើតនៅ',
    period: 'រយៈពេល',
    outstanding: 'កម្ចីដែលបានផ្តល់',
    activeLoans: 'អតិថិជនសរុប',
    overdue: 'ហួសកាល',
    interestEarned: 'ការប្រាក់ទទួលបាន',
    totalReceived: 'សរុបទទួល',
    interest: 'ការប្រាក់',
    principalIn: 'ដើមទុនទទួល',
    capitalOut: 'កម្ចីដែលបានផ្តល់',
    netFlow: 'លំហូរសុទ្ធ',
    newLoan: 'ប្រាក់កម្ចីថ្មី',
    newLoans: 'ប្រាក់កម្ចីថ្មី',
    payments: 'ការបង់',
    payment: 'ការបង់',
    noData: 'មិនទាន់មានទិន្នន័យ',
    loading: 'កំពុងផ្ទុក...',
    months: ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'],
  },
};

// ---------------------------------------------------------------------------
// buildReportHtml — generates PDF-ready HTML from report data
// ---------------------------------------------------------------------------
function buildReportHtml({ portfolioStats, overviewTotals, filteredGroups, periodLabel, monthLabel }, t) {
  const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtKHR = n => '៛' + Math.round(n).toLocaleString();
  const fmtNet = n => (n >= 0 ? fmtUSD(n) : '−' + fmtUSD(Math.abs(n)));
  const fmtNetK = n => (n >= 0 ? fmtKHR(n) : '−' + fmtKHR(Math.abs(n)));

  const now = new Date();
  const generatedStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const { outstandingUSD, outstandingKHR, activeCount, overdueCount } = portfolioStats;
  const { interestUSD, interestKHR, receivedUSD, receivedKHR } = overviewTotals;

  // Overview table rows
  const overviewRows = [];
  if (outstandingUSD > 0 || outstandingKHR > 0) {
    const val = [outstandingUSD > 0 ? fmtUSD(outstandingUSD) : null, outstandingKHR > 0 ? fmtKHR(outstandingKHR) : null]
      .filter(Boolean).join('<br/><span class="sub">') + (outstandingUSD > 0 && outstandingKHR > 0 ? '</span>' : '');
    overviewRows.push(`<tr><td>${t.outstanding}</td><td>${val}</td></tr>`);
  }
  overviewRows.push(`<tr><td>${t.activeLoans}</td><td>${activeCount + overdueCount}${overdueCount > 0 ? ` <span class="sub">(${overdueCount} ${t.overdue})</span>` : ''}</td></tr>`);
  if (interestUSD > 0 || interestKHR > 0) {
    const val = [interestUSD > 0 ? fmtUSD(interestUSD) : null, interestKHR > 0 ? fmtKHR(interestKHR) : null]
      .filter(Boolean).join('<br/><span class="sub">') + (interestUSD > 0 && interestKHR > 0 ? '</span>' : '');
    overviewRows.push(`<tr><td>${t.interestEarned}</td><td>${val}</td></tr>`);
  }
  if (receivedUSD > 0 || receivedKHR > 0) {
    const val = [receivedUSD > 0 ? fmtUSD(receivedUSD) : null, receivedKHR > 0 ? fmtKHR(receivedKHR) : null]
      .filter(Boolean).join('<br/><span class="sub">') + (receivedUSD > 0 && receivedKHR > 0 ? '</span>' : '');
    overviewRows.push(`<tr><td>${t.totalReceived}</td><td>${val}</td></tr>`);
  }

  // Monthly breakdown rows
  const monthRows = filteredGroups.map(g => {
    const payCount = g.usdCount + g.khrCount;
    const totalRecUSD = g.usdInterest + g.usdPrincipal;
    const totalRecKHR = g.khrInterest + g.khrPrincipal;
    const netUSD = totalRecUSD - g.usdDeployed;
    const netKHR = totalRecKHR - g.khrDeployed;
    const hasUSD = g.usdCount > 0 || g.usdDeployed > 0;
    const hasKHR = g.khrCount > 0 || g.khrDeployed > 0;

    const cell = (usdVal, khrVal) => {
      const parts = [];
      if (usdVal != null) parts.push(usdVal);
      if (khrVal != null) parts.push(`<span class="sub">${khrVal}</span>`);
      return parts.join('<br/>') || '—';
    };

    const netUSDStr = hasUSD ? fmtNet(netUSD) : null;
    const netKHRStr = hasKHR ? fmtNetK(netKHR) : null;
    const primaryNet = hasUSD ? netUSD : netKHR;
    const netClass = primaryNet >= 0 ? 'pos' : 'neg';

    return `<tr>
      <td>${monthLabel(g.key)}</td>
      <td>${payCount > 0 ? payCount : '—'}</td>
      <td>${g.newLoanCount > 0 ? g.newLoanCount : '—'}</td>
      <td>${cell(g.usdCount > 0 ? fmtUSD(g.usdInterest) : null, g.khrCount > 0 ? fmtKHR(g.khrInterest) : null)}</td>
      <td>${cell(g.usdCount > 0 ? fmtUSD(g.usdPrincipal) : null, g.khrCount > 0 ? fmtKHR(g.khrPrincipal) : null)}</td>
      <td>${cell(g.usdCount > 0 ? fmtUSD(totalRecUSD) : null, g.khrCount > 0 ? fmtKHR(totalRecKHR) : null)}</td>
      <td>${cell(g.usdDeployed > 0 ? fmtUSD(g.usdDeployed) : null, g.khrDeployed > 0 ? fmtKHR(g.khrDeployed) : null)}</td>
      <td class="${netClass}">${cell(netUSDStr, netKHRStr)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; background: #fff; }
  h1 { font-size: 22px; font-weight: 700; color: #00C2B2; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #888; margin-bottom: 24px; }
  h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #00C2B2; color: #fff; font-size: 11px; font-weight: 600; text-align: left; padding: 7px 10px; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
  tr:nth-child(even) td { background: #f7fafa; }
  .sub { font-size: 10px; color: #888; }
  .pos { color: #10B981; font-weight: 600; }
  .neg { color: #EF4444; font-weight: 600; }
</style>
</head>
<body>
<h1>${t.exportTitle}</h1>
<div class="meta">${t.generated}: ${generatedStr} &nbsp;|&nbsp; ${t.period}: ${periodLabel}</div>

<h2>${t.outstanding} &amp; ${t.activeLoans}</h2>
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>${overviewRows.join('')}</tbody>
</table>

<h2>Monthly Breakdown</h2>
<table>
  <thead>
    <tr>
      <th>Month</th>
      <th>${t.payments}</th>
      <th>${t.newLoans}</th>
      <th>${t.interest}</th>
      <th>${t.principalIn}</th>
      <th>${t.totalReceived}</th>
      <th>${t.capitalOut}</th>
      <th>${t.netFlow}</th>
    </tr>
  </thead>
  <tbody>${monthRows}</tbody>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// MetricRow — dot + label + right-aligned USD / KHR values
// ---------------------------------------------------------------------------
function MetricRow({ dot, label, usd, khr, color, colorSub, ff, styles, colors }) {
  return (
    <View style={styles.metricRow}>
      {dot
        ? <View style={[styles.metricDot, { backgroundColor: color }]} />
        : <View style={styles.metricDotPlaceholder} />
      }
      <Text style={[styles.metricLabel, { color: colors.textMuted }, ff('500')]}>{label}</Text>
      <View style={styles.metricVals}>
        {usd != null && (
          <Text style={[styles.metricVal, { color }, ff('600')]}>{usd}</Text>
        )}
        {khr != null && (
          <Text style={[styles.metricValSub, { color: colorSub ?? (color + 'BB') }, ff('400')]}>{khr}</Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const ReportsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff, fs), [ff, fs]);

  const { loans, loansLoaded } = useData();
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedYear, setSelectedYear] = useState(null); // null = all time
  const [exporting, setExporting]   = useState(false);

  useEffect(() => {
    if (!loansLoaded) return;
    setLoading(true);
    getBorrowerPayments(loans)
      .then(p => { setPayments(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [loansLoaded]);

  const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtKHR = n => '៛' + Math.round(n).toLocaleString();

  const monthLabel = key => {
    const [yr, mo] = key.split('-').map(Number);
    return `${t.months[mo - 1]} ${yr}`;
  };

  // --- Live portfolio stats (not year-filtered) ---
  const portfolioStats = useMemo(() => {
    let outstandingUSD = 0, outstandingKHR = 0;
    let activeCount = 0, overdueCount = 0;
    for (const loan of loans) {
      if (loan.status === 'active' || loan.status === 'overdue') {
        const p = loan.currentPrincipal ?? 0;
        if (loan.currency === 'KHR') outstandingKHR += p;
        else outstandingUSD += p;
        if (loan.status === 'overdue') overdueCount++;
        else activeCount++;
      }
    }
    return { outstandingUSD, outstandingKHR, activeCount, overdueCount };
  }, [loans]);

  // --- Monthly groups (payments + loan deployments) ---
  const { monthGroups, years } = useMemo(() => {
    const groups = {};
    const yearSet = new Set();

    const ensureGroup = mk => {
      if (!groups[mk]) {
        groups[mk] = {
          key: mk,
          usdInterest: 0, usdPrincipal: 0, usdDeployed: 0, usdCount: 0,
          khrInterest: 0, khrPrincipal: 0, khrDeployed: 0, khrCount: 0,
          newLoanCount: 0,
        };
      }
      return groups[mk];
    };

    for (const pay of payments) {
      if (!pay.date) continue;
      const mk = pay.date.slice(0, 7);
      yearSet.add(mk.slice(0, 4));
      const isKHR = (pay.loanCurrency ?? pay.currency) === 'KHR';
      const g = ensureGroup(mk);
      if (isKHR) {
        g.khrInterest  += pay.interestAmount  ?? 0;
        g.khrPrincipal += pay.principalAmount ?? 0;
        g.khrCount++;
      } else {
        g.usdInterest  += pay.interestAmount  ?? 0;
        g.usdPrincipal += pay.principalAmount ?? 0;
        g.usdCount++;
      }
    }

    for (const loan of loans) {
      if (!loan.startDate) continue;
      const mk = loan.startDate.slice(0, 7);
      yearSet.add(mk.slice(0, 4));
      const isKHR = loan.currency === 'KHR';
      const principal = loan.originalPrincipal ?? loan.principal ?? 0;
      const g = ensureGroup(mk);
      if (isKHR) g.khrDeployed += principal;
      else g.usdDeployed += principal;
      g.newLoanCount++;
    }

    const sorted = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    const sortedYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
    return { monthGroups: sorted, years: sortedYears };
  }, [payments, loans]);

  // --- Filtered month groups ---
  const filteredGroups = useMemo(() => {
    if (!selectedYear) return monthGroups;
    return monthGroups.filter(g => g.key.startsWith(selectedYear));
  }, [monthGroups, selectedYear]);

  // --- Period totals for overview cards ---
  const overviewTotals = useMemo(() => {
    let interestUSD = 0, interestKHR = 0, receivedUSD = 0, receivedKHR = 0;
    for (const g of filteredGroups) {
      interestUSD += g.usdInterest;
      interestKHR += g.khrInterest;
      receivedUSD += g.usdInterest + g.usdPrincipal;
      receivedKHR += g.khrInterest + g.khrPrincipal;
    }
    return { interestUSD, interestKHR, receivedUSD, receivedKHR };
  }, [filteredGroups]);

  const periodLabel = selectedYear ?? t.allTime;

  const handleExport = async () => {
    if (exporting || filteredGroups.length === 0) return;
    setExporting(true);
    try {
      const html = buildReportHtml(
        { portfolioStats, overviewTotals, filteredGroups, periodLabel, monthLabel },
        t,
      );
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: t.exportTitle,
      });
    } catch (e) {
      Alert.alert(t.exportError, e.message || '');
    } finally {
      setExporting(false);
    }
  };

  // --- Month card ---
  const renderMonth = ({ item: g }) => {
    const payCount = g.usdCount + g.khrCount;
    const hasDeployed = g.usdDeployed > 0 || g.khrDeployed > 0;
    const totalRecUSD = g.usdInterest + g.usdPrincipal;
    const totalRecKHR = g.khrInterest + g.khrPrincipal;
    const netUSD = totalRecUSD - g.usdDeployed;
    const netKHR = totalRecKHR - g.khrDeployed;
    // Determine net color by the primary (USD) currency, fall back to KHR
    const primaryNet = (g.usdCount > 0 || g.usdDeployed > 0) ? netUSD : netKHR;
    const netColor = primaryNet >= 0 ? GREEN : RED;
    const netIcon = primaryNet >= 0 ? 'trending-up-outline' : 'trending-down-outline';

    const fmtNet = (n) => (n >= 0 ? fmtUSD(n) : '−' + fmtUSD(Math.abs(n)));
    const fmtNetK = (n) => (n >= 0 ? fmtKHR(n) : '−' + fmtKHR(Math.abs(n)));

    const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    return (
      <GlassCard style={styles.monthCard}>
        <View style={styles.monthCardInner}>
          {/* Header */}
          <View style={styles.monthHeader}>
            <Text style={[styles.monthLabel, { color: colors.text }, ff('700')]}>{monthLabel(g.key)}</Text>
            <View style={styles.monthPills}>
              {payCount > 0 && (
                <View style={[styles.pill, { backgroundColor: pillBg }]}>
                  <Text style={[styles.pillText, { color: colors.textMuted }, ff('500')]}>
                    {payCount} {payCount === 1 ? t.payment : t.payments}
                  </Text>
                </View>
              )}
              {g.newLoanCount > 0 && (
                <View style={[styles.pill, { backgroundColor: AMBER + '22' }]}>
                  <Text style={[styles.pillText, { color: AMBER }, ff('500')]}>
                    {g.newLoanCount} {g.newLoanCount === 1 ? t.newLoan : t.newLoans}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Interest */}
          <MetricRow
            dot label={t.interest}
            usd={g.usdCount > 0 ? fmtUSD(g.usdInterest) : null}
            khr={g.khrCount > 0 ? fmtKHR(g.khrInterest) : null}
            color={ACCENT}
            ff={ff} styles={styles} colors={colors}
          />

          {/* Principal In */}
          <MetricRow
            dot label={t.principalIn}
            usd={g.usdCount > 0 ? fmtUSD(g.usdPrincipal) : null}
            khr={g.khrCount > 0 ? fmtKHR(g.khrPrincipal) : null}
            color={GREEN}
            ff={ff} styles={styles} colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Total Received */}
          <View style={styles.totalRow}>
            <View style={styles.metricDotPlaceholder} />
            <Text style={[styles.totalLabel, { color: colors.text }, ff('600')]}>{t.totalReceived}</Text>
            <View style={styles.metricVals}>
              {g.usdCount > 0 && (
                <Text style={[styles.totalVal, { color: GREEN }, ff('700')]}>{fmtUSD(totalRecUSD)}</Text>
              )}
              {g.khrCount > 0 && (
                <Text style={[styles.totalValSub, { color: GREEN + 'BB' }, ff('600')]}>{fmtKHR(totalRecKHR)}</Text>
              )}
            </View>
          </View>

          {/* Capital Out + Net Flow — only when loans were deployed this month */}
          {hasDeployed && (
            <>
              <View style={[styles.dividerDouble, { backgroundColor: colors.border }]} />

              {/* Capital Out */}
              <MetricRow
                dot label={t.capitalOut}
                usd={g.usdDeployed > 0 ? '−' + fmtUSD(g.usdDeployed) : null}
                khr={g.khrDeployed > 0 ? '−' + fmtKHR(g.khrDeployed) : null}
                color={AMBER}
                ff={ff} styles={styles} colors={colors}
              />

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Net Flow */}
              <View style={styles.netRow}>
                <Ionicons name={netIcon} size={14} color={netColor} style={styles.netIcon} />
                <Text style={[styles.netLabel, { color: colors.text }, ff('600')]}>{t.netFlow}</Text>
                <View style={styles.metricVals}>
                  {(g.usdCount > 0 || g.usdDeployed > 0) && (
                    <Text style={[styles.netVal, { color: netColor }, ff('700')]}>{fmtNet(netUSD)}</Text>
                  )}
                  {(g.khrCount > 0 || g.khrDeployed > 0) && (
                    <Text style={[styles.netValSub, { color: netColor + 'BB' }, ff('500')]}>{fmtNetK(netKHR)}</Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </GlassCard>
    );
  };

  // --- List header: year pills + overview grid ---
  const { outstandingUSD, outstandingKHR, activeCount, overdueCount } = portfolioStats;
  const { interestUSD, interestKHR, receivedUSD, receivedKHR } = overviewTotals;

  const OverviewCard = ({ tagIcon, tagLabel, tagColor, mainVal, subVal, hint }) => (
    <GlassCard style={styles.overviewCard}>
      <View style={styles.overviewCardInner}>
        <View style={[styles.overviewTag, { backgroundColor: tagColor + '22' }]}>
          <Ionicons name={tagIcon} size={13} color={tagColor} />
          <Text style={[styles.overviewTagText, { color: tagColor }, ff('600')]}>{tagLabel}</Text>
        </View>
        <Text style={[styles.overviewMain, { color: tagColor }, ff('800')]}>{mainVal}</Text>
        {subVal != null && (
          <Text style={[styles.overviewSub, { color: tagColor + 'BB' }, ff('700')]}>{subVal}</Text>
        )}
        <Text style={[styles.overviewHint, { color: colors.textMuted }, ff('400')]}>{hint}</Text>
      </View>
    </GlassCard>
  );

  const ListHeader = () => (
    <>
      {/* Year filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.yearBar}
        contentContainerStyle={styles.yearBarContent}
      >
        {[null, ...years].map(yr => {
          const active = selectedYear === yr;
          return (
            <TouchableOpacity
              key={yr ?? 'all'}
              onPress={() => setSelectedYear(yr)}
              activeOpacity={0.7}
              style={[
                styles.yearPill,
                { backgroundColor: active ? ACCENT : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') },
              ]}
            >
              <Text style={[styles.yearPillText, { color: active ? '#fff' : colors.textMuted }, ff(active ? '600' : '500')]}>
                {yr ?? t.allTime}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Overview 2×2 grid */}
      <View style={styles.overviewGrid}>
        <OverviewCard
          tagIcon="wallet-outline"
          tagLabel={t.outstanding}
          tagColor={ACCENT}
          mainVal={outstandingUSD > 0 ? fmtUSD(outstandingUSD) : outstandingKHR > 0 ? fmtKHR(outstandingKHR) : '—'}
          subVal={(outstandingUSD > 0 && outstandingKHR > 0) ? fmtKHR(outstandingKHR) : null}
          hint={t.allTime}
        />
        <OverviewCard
          tagIcon="people-outline"
          tagLabel={t.activeLoans}
          tagColor={GREEN}
          mainVal={String(activeCount + overdueCount)}
          subVal={overdueCount > 0 ? `${overdueCount} ${t.overdue}` : null}
          hint={t.allTime}
        />
        <OverviewCard
          tagIcon="trending-up-outline"
          tagLabel={t.interestEarned}
          tagColor={ACCENT}
          mainVal={interestUSD > 0 ? fmtUSD(interestUSD) : interestKHR > 0 ? fmtKHR(interestKHR) : '—'}
          subVal={(interestUSD > 0 && interestKHR > 0) ? fmtKHR(interestKHR) : null}
          hint={periodLabel}
        />
        <OverviewCard
          tagIcon="cash-outline"
          tagLabel={t.totalReceived}
          tagColor={TEAL}
          mainVal={receivedUSD > 0 ? fmtUSD(receivedUSD) : receivedKHR > 0 ? fmtKHR(receivedKHR) : '—'}
          subVal={(receivedUSD > 0 && receivedKHR > 0) ? fmtKHR(receivedKHR) : null}
          hint={periodLabel}
        />
      </View>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }, ff('700')]}>{t.title}</Text>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting || filteredGroups.length === 0}
            style={{ opacity: filteredGroups.length === 0 ? 0.3 : 1, width: 40, alignItems: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            {exporting
              ? <ActivityIndicator size="small" color={ACCENT} />
              : <Ionicons name="share-outline" size={22} color={ACCENT} />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }, ff('400')]}>{t.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const makeStyles = (ff, fs) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: 'center', paddingVertical: 4 },
  headerTitle: { fontSize: fs(18), lineHeight: 30 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: fs(14), lineHeight: 26 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },

  // Year bar
  yearBar: { marginTop: 16 },
  yearBarContent: { paddingHorizontal: 0, gap: 8, flexDirection: 'row' },
  yearPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  yearPillText: { fontSize: fs(13), lineHeight: 24 },

  // Overview grid
  overviewGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    marginTop: 16, marginBottom: 16,
  },
  overviewCard: { width: '47.5%' },
  overviewCardInner: { padding: 14, gap: 2 },
  overviewTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  overviewTagText: { fontSize: fs(10), lineHeight: 20 },
  overviewMain: { fontSize: fs(18), lineHeight: 30 },
  overviewSub: { fontSize: fs(13), lineHeight: 24 },
  overviewHint: { fontSize: fs(11), lineHeight: 21, marginTop: 4 },

  // Month cards
  monthCard: { marginBottom: 12 },
  monthCardInner: { paddingHorizontal: 16, paddingVertical: 14 },
  monthHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  monthLabel: { fontSize: fs(15), lineHeight: 26, flexShrink: 1, marginRight: 8 },
  monthPills: { flexDirection: 'row', gap: 6, flexShrink: 1, justifyContent: 'flex-end', flexWrap: 'wrap' },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: fs(11), lineHeight: 21 },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  dividerDouble: { height: StyleSheet.hairlineWidth, marginVertical: 10 },

  // MetricRow
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  metricDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  metricDotPlaceholder: { width: 8, height: 8, flexShrink: 0 },
  metricLabel: { flex: 1, fontSize: fs(13), lineHeight: 24, letterSpacing: 0 },
  metricVals: { alignItems: 'flex-end', gap: 2, flexShrink: 0, minWidth: 80 },
  metricVal: { fontSize: fs(13), lineHeight: 24, letterSpacing: 0 },
  metricValSub: { fontSize: fs(11), lineHeight: 21, letterSpacing: 0 },

  // Total Received row
  totalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 2 },
  totalLabel: { flex: 1, fontSize: fs(13), lineHeight: 24, letterSpacing: 0, marginLeft: 16 },
  totalVal: { fontSize: fs(15), lineHeight: 26, letterSpacing: 0 },
  totalValSub: { fontSize: fs(12), lineHeight: 23, letterSpacing: 0 },

  // Net Flow row
  netRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  netIcon: { marginRight: 6, flexShrink: 0 },
  netLabel: { flex: 1, fontSize: fs(13), lineHeight: 24, letterSpacing: 0 },
  netVal: { fontSize: fs(14), lineHeight: 26, letterSpacing: 0 },
  netValSub: { fontSize: fs(11), lineHeight: 21, letterSpacing: 0 },

  // Empty state
  emptyWrap: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 80 },
  emptyText: { fontSize: fs(15), lineHeight: 26, letterSpacing: 0 },
});

export default ReportsScreen;
