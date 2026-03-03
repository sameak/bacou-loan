/**
 * EXCHANGE RATES SCREEN
 * Shows today's USD → KHR / KRW rates from 3 free sources side by side.
 * Cached once per calendar day in AsyncStorage; manual refresh available.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';

const ACCENT = '#6366F1';
const GREEN  = '#10B981';
const CACHE_KEY = 'exchange_rates_v1';

// ─── Data sources (all free, no API key required) ────────────────────────────

const SOURCES = [
  {
    id: 'fawaz',
    name: 'Currency-API',
    badge: 'CDN',
    badgeColor: '#6366F1',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    parse: d => ({ KHR: d?.usd?.khr, KRW: d?.usd?.krw }),
  },
  {
    id: 'open_er',
    name: 'Open ER-API',
    badge: 'ECB',
    badgeColor: '#0EA5E9',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: d => ({ KHR: d?.rates?.KHR, KRW: d?.rates?.KRW }),
  },
  {
    id: 'er_api',
    name: 'ExchangeRate-API',
    badge: 'Free',
    badgeColor: '#10B981',
    url: 'https://api.exchangerate-api.com/v4/latest/USD',
    parse: d => ({ KHR: d?.rates?.KHR, KRW: d?.rates?.KRW }),
  },
];

// ─── Currency pairs to display ────────────────────────────────────────────────

const PAIRS = [
  { code: 'KHR', flag: '🇰🇭', symbol: '៛', en: 'Cambodian Riel', km: 'រៀលកម្ពុជា' },
  { code: 'KRW', flag: '🇰🇷', symbol: '₩', en: 'Korean Won',     km: 'វ៉ុនកូរ៉េ' },
];

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Exchange Rates',
    subtitle: '1 USD equals',
    updatedToday: 'Updated today at',
    updatedOn: 'Updated on',
    loading: 'Fetching rates…',
    error: 'Failed to load',
    avg: 'Average',
    source: 'Source',
    allFailed: 'Could not reach any source. Check your connection.',
    noCache: 'No cached rates. Pull down to refresh.',
  },
  km: {
    title: 'អត្រាប្ដូររូបិយប័ណ្ណ',
    subtitle: '1 ដុល្លា ស្មើ',
    updatedToday: 'ធ្វើបច្ចុប្បន្នភាពថ្ងៃនេះ',
    updatedOn: 'ធ្វើបច្ចុប្បន្នភាព',
    loading: 'កំពុងទាញទិន្នន័យ…',
    error: 'ទាញបរាជ័យ',
    avg: 'មធ្យម',
    source: 'ប្រភព',
    allFailed: 'មិនអាចភ្ជាប់ប្រភព។ សូមពិនិត្យការតភ្ជាប់។',
    noCache: 'គ្មានទិន្នន័យ។ អូសចុះដើម្បីផ្ទុក។',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

function fetchWithTimeout(url, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchAllSources() {
  const results = await Promise.allSettled(
    SOURCES.map(async (src) => {
      const res = await fetchWithTimeout(src.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rates = src.parse(data);
      if (!rates.KHR && !rates.KRW) throw new Error('No rate data');
      return { id: src.id, rates };
    })
  );

  return results.map((r, i) => ({
    ...SOURCES[i],
    rates: r.status === 'fulfilled' ? r.value.rates : null,
    error: r.status === 'rejected' ? true : false,
  }));
}

async function loadRates(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.date === todayStr()) {
          return { sources: cached.sources, time: cached.time, fromCache: true };
        }
      }
    } catch {}
  }

  const sources = await fetchAllSources();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayStr(), sources, time }));
  } catch {}
  return { sources, time, fromCache: false };
}

function fmtRate(value, code) {
  if (!value) return '—';
  const rounded = Math.round(value);
  return rounded.toLocaleString('en-US');
}

function avg(sources, code) {
  const vals = sources.filter(s => s.rates?.[code]).map(s => s.rates[code]);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const ExchangeRatesScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff, fs), [ff, fs]);

  const [sources, setSources]     = useState([]);
  const [time, setTime]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const doLoad = useCallback(async (force = false) => {
    try {
      const result = await loadRates(force);
      setSources(result.sources);
      setTime(result.time);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    doLoad(false).finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await doLoad(true);
    setRefreshing(false);
  }, [doLoad]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderPairCard = (pair) => {
    const avgVal = avg(sources, pair.code);

    return (
      <GlassCard key={pair.code} style={styles.pairCard}>
        <View style={styles.pairCardInner}>

          {/* Currency header */}
          <View style={styles.pairHeader}>
            <Text style={styles.pairFlag}>{pair.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pairCode, { color: colors.text }, ff('800')]}>{pair.code}</Text>
              <Text style={[styles.pairName, { color: colors.textMuted }, ff('400')]}>
                {language === 'km' ? pair.km : pair.en}
              </Text>
            </View>
            <View style={[styles.basePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.basePillText, { color: colors.textMuted }, ff('500')]}>{t.subtitle}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Source rows */}
          {sources.map((src, idx) => {
            const val = src.rates?.[pair.code];
            const isErr = src.error || !val;
            const isHighest = !isErr && sources.every(s => !s.rates?.[pair.code] || s.rates[pair.code] <= val);
            const isLowest  = !isErr && sources.every(s => !s.rates?.[pair.code] || s.rates[pair.code] >= val);

            return (
              <View key={src.id} style={[styles.sourceRow, idx < sources.length - 1 && styles.sourceRowBorder, { borderBottomColor: colors.border }]}>
                {/* Source name + badge */}
                <View style={styles.sourceLeft}>
                  <Text style={[styles.sourceName, { color: colors.text }, ff('500')]}>{src.name}</Text>
                  <View style={[styles.sourceBadge, { backgroundColor: src.badgeColor + '22' }]}>
                    <Text style={[styles.sourceBadgeText, { color: src.badgeColor }, ff('600')]}>{src.badge}</Text>
                  </View>
                </View>

                {/* Rate value */}
                <View style={styles.sourceRight}>
                  {isErr ? (
                    <Text style={[styles.errText, ff('500')]}>{t.error}</Text>
                  ) : (
                    <View style={styles.rateWrap}>
                      <Text style={[styles.rateSymbol, { color: isHighest ? GREEN : colors.textMuted }, ff('600')]}>
                        {pair.symbol}
                      </Text>
                      <Text style={[styles.rateValue, { color: isHighest ? GREEN : colors.text }, ff('700')]}>
                        {fmtRate(val, pair.code)}
                      </Text>
                      {isHighest && !isLowest && (
                        <Ionicons name="arrow-up" size={12} color={GREEN} style={{ marginLeft: 3 }} />
                      )}
                      {isLowest && !isHighest && (
                        <Ionicons name="arrow-down" size={12} color="#EF4444" style={{ marginLeft: 3 }} />
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Average row */}
          {avgVal != null && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 4 }]} />
              <View style={styles.avgRow}>
                <Text style={[styles.avgLabel, { color: colors.textMuted }, ff('500')]}>{t.avg}</Text>
                <View style={styles.rateWrap}>
                  <Text style={[styles.rateSymbol, { color: ACCENT }, ff('600')]}>{pair.symbol}</Text>
                  <Text style={[styles.avgValue, { color: ACCENT }, ff('800')]}>{fmtRate(avgVal, pair.code)}</Text>
                </View>
              </View>
            </>
          )}

        </View>
      </GlassCard>
    );
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <GlassCard style={styles.pairCard}>
      <View style={styles.pairCardInner}>
        <View style={[styles.skeletonRow, { width: 140, height: 18, marginBottom: 6, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
        <View style={[styles.skeletonRow, { width: 100, height: 13, marginBottom: 14, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.sourceRow, { borderBottomColor: colors.border }, i < 3 && styles.sourceRowBorder]}>
            <View style={[styles.skeletonRow, { flex: 1, height: 14, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
            <View style={[styles.skeletonRow, { width: 80, height: 14, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
          </View>
        ))}
      </View>
    </GlassCard>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { color: colors.text }, ff('700')]}>{t.title}</Text>
            {time != null && (
              <Text style={[styles.headerSub, { color: colors.textMuted }, ff('400')]}>
                {t.updatedToday} {time}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            onPress={onRefresh}
            activeOpacity={0.7}
            disabled={refreshing}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={ACCENT} />
              : <Ionicons name="refresh-outline" size={20} color={colors.text} />
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >

        {/* ── Source legend ── */}
        {!loading && sources.length > 0 && (
          <View style={styles.legend}>
            {sources.map(src => (
              <View key={src.id} style={[styles.legendItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <View style={[styles.legendDot, { backgroundColor: src.badgeColor }]} />
                <Text style={[styles.legendText, { color: colors.textMuted }, ff('500')]}>{src.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <>
            {renderSkeleton()}
            {renderSkeleton()}
          </>
        )}

        {/* ── Error state (all sources failed, no cache) ── */}
        {!loading && fetchError && sources.length === 0 && (
          <GlassCard style={styles.pairCard}>
            <View style={[styles.pairCardInner, styles.errorWrap]}>
              <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.errorText, { color: colors.textMuted }, ff('500')]}>{t.allFailed}</Text>
            </View>
          </GlassCard>
        )}

        {/* ── Pair cards ── */}
        {!loading && sources.length > 0 && PAIRS.map(renderPairCard)}

      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (ff, fs) => StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:    { width: 40, alignItems: 'center', paddingVertical: 4 },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs(17), lineHeight: 22, letterSpacing: 0 },
  headerSub:   { fontSize: fs(11), lineHeight: 15, letterSpacing: 0, marginTop: 1 },

  // Content
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  // Legend row
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: fs(11), lineHeight: 15, letterSpacing: 0 },

  // Pair card
  pairCard:      { marginBottom: 14 },
  pairCardInner: { padding: 16 },

  pairHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pairFlag:   { fontSize: 28, lineHeight: 34 },
  pairCode:   { fontSize: fs(18), lineHeight: 23, letterSpacing: 0 },
  pairName:   { fontSize: fs(12), lineHeight: 17, letterSpacing: 0 },

  basePill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  basePillText: { fontSize: fs(11), lineHeight: 15, letterSpacing: 0 },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 10 },

  // Source rows
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  sourceRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },

  sourceLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  sourceName:  { fontSize: fs(13), lineHeight: 18, letterSpacing: 0, flexShrink: 1 },
  sourceBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sourceBadgeText: { fontSize: fs(10), lineHeight: 14, letterSpacing: 0 },

  sourceRight: { flexShrink: 0, alignItems: 'flex-end' },
  rateWrap:    { flexDirection: 'row', alignItems: 'center', gap: 1 },
  rateSymbol:  { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },
  rateValue:   { fontSize: fs(17), lineHeight: 22, letterSpacing: 0 },
  errText:     { fontSize: fs(12), lineHeight: 17, letterSpacing: 0, color: '#EF4444' },

  // Average row
  avgRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  avgLabel: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },
  avgValue: { fontSize: fs(18), lineHeight: 23, letterSpacing: 0 },

  // Skeleton
  skeletonRow: { marginBottom: 4 },

  // Error
  errorWrap: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
  errorText: { fontSize: fs(14), lineHeight: 20, letterSpacing: 0, textAlign: 'center' },
});

export default ExchangeRatesScreen;
