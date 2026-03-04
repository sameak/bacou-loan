/**
 * MARKET RATES SCREEN
 *
 * Tab 1 — Exchange Rate: USD → KHR / KRW from 3 free sources.
 * Tab 2 — Gold Price:    XAU spot from 3 free sources + unit conversions.
 *
 * Each tab loads lazily on first visit and caches per calendar day.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const ACCENT  = '#6366F1';
const GREEN   = '#10B981';
const GOLD_C  = '#F59E0B';

const TROY_OZ = 31.1035;   // grams per troy ounce
const CHI_G   = 3.75;      // grams per chi (Cambodian/Vietnamese unit)

const FX_CACHE   = 'exchange_rates_v3';   // v3: adds NBC source
const GOLD_CACHE = 'gold_rates_v3';

// ─── Exchange-rate sources ────────────────────────────────────────────────────

const FX_SOURCES = [
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
  {
    id: 'nbc',
    name: 'Natl. Bank Cambodia',
    badge: 'NBC',
    badgeColor: '#DC2626',
    type: 'html',
    url: 'https://www.nbc.gov.kh/english/economic_research/exchange_rate.php',
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    parse: html => {
      // Official USD/KHR: "4013 KHR / USD" or inside a font tag
      const usdMatch = html.match(/(\d{4,5})\s*KHR\s*\/\s*USD/i);
      const usdKHR = usdMatch ? parseInt(usdMatch[1]) : null;

      // KRW cross rate row: KRW/KHR | unit | buy | sell
      const krwMatch = html.match(/KRW\/KHR<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>/i);
      const krwUnit = krwMatch ? parseInt(krwMatch[1]) : 100;
      const krwBuy  = krwMatch ? parseInt(krwMatch[2]) : null;

      // USD/KRW via cross-rate: usdKHR ÷ (krwBuy / krwUnit)
      const usdKRW = (usdKHR && krwBuy && krwUnit)
        ? Math.round(usdKHR / (krwBuy / krwUnit))
        : null;

      return { KHR: usdKHR, KRW: usdKRW };
    },
  },
];

// ─── Gold-price sources ───────────────────────────────────────────────────────

const GOLD_SOURCES = [
  {
    id: 'fawaz_xau',
    name: 'Currency-API',
    badge: 'CDN',
    badgeColor: '#6366F1',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json',
    // xau.usd = price of 1 troy oz in USD; xau.khr = price in KHR
    parse: d => ({
      usdPerOz: d?.xau?.usd,
      khrPerOz: d?.xau?.khr,
    }),
  },
  {
    id: 'fawaz_alt',
    name: 'Currency-API Alt',
    badge: 'CF',
    badgeColor: '#8B5CF6',
    url: 'https://latest.currency-api.pages.dev/v1/currencies/xau.json',
    parse: d => ({
      usdPerOz: d?.xau?.usd,
      khrPerOz: d?.xau?.khr,
    }),
  },
  {
    id: 'yahoo_gc',
    name: 'Yahoo Finance',
    badge: 'GC=F',
    badgeColor: '#6D28D9',
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=1d&includePrePost=false',
    // Gold futures — regularMarketPrice is USD per troy oz
    parse: d => ({ usdPerOz: d?.chart?.result?.[0]?.meta?.regularMarketPrice }),
  },
];

// ─── Currency pairs (FX tab) ──────────────────────────────────────────────────

const FX_PAIRS = [
  { code: 'KHR', flag: '🇰🇭', symbol: '៛', en: 'Cambodian Riel', km: 'រៀលកម្ពុជា' },
  { code: 'KRW', flag: '🇰🇷', symbol: '₩', en: 'Korean Won',     km: 'វ៉ុនកូរ៉េ' },
];

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Market Rates',
    tabFX:   'Exchange Rate',
    tabGold: 'Gold Price',
    subtitle: '1 USD equals',
    updatedToday: 'Updated today at',
    loading: 'Fetching…',
    error: 'Failed',
    avg: 'Average',
    allFailed: 'Could not reach any source. Check your connection.',
    // Gold
    goldTitle:   'Gold Spot (XAU)',
    goldSub:     'Per troy ounce · USD',
    perOz:       'Per troy oz',
    perGram:     'Per gram',
    perChi:      'Per chi (3.75 g)',
    perGramKHR:  'Per gram (KHR)',
    conversions: 'Unit Conversions',
    convNote:    'Based on average price',
  },
  km: {
    title: 'អត្រាទីផ្សារ',
    tabFX:   'អត្រាប្ដូរ',
    tabGold: 'តម្លៃមាស',
    subtitle: '1 ដុល្លា ស្មើ',
    updatedToday: 'ធ្វើបច្ចុប្បន្នភាពថ្ងៃនេះ',
    loading: 'កំពុងទាញ…',
    error: 'បរាជ័យ',
    avg: 'មធ្យម',
    allFailed: 'មិនអាចភ្ជាប់ប្រភព។ សូមពិនិត្យការតភ្ជាប់។',
    goldTitle:   'មាសទីផ្សារ (XAU)',
    goldSub:     'ក្នុងមួយត្រូយអោន · ដុល្លា',
    perOz:       'ក្នុងមួយអោន',
    perGram:     'ក្នុងមួយក្រាម',
    perChi:      'ក្នុងមួយជី (៣.៧៥ ក្រ)',
    perGramKHR:  'ក្នុងមួយក្រាម (រៀល)',
    conversions: 'ការបំប្លែងឯកតា',
    convNote:    'គិតតាមមធ្យមភាគ',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

async function fetchSources(sources) {
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(src.url, {
        signal: controller.signal,
        headers: src.headers ?? {},
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body   = src.type === 'html' ? await res.text() : await res.json();
      const parsed = src.parse(body);
      if (!parsed) throw new Error('No data');
      return { id: src.id, parsed };
    })
  );
  return results.map((r, i) => ({
    ...sources[i],
    parsed: r.status === 'fulfilled' ? r.value.parsed : null,
    error:  r.status === 'rejected',
  }));
}

async function loadCached(cacheKey, forceRefresh, fetchFn) {
  if (!forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.date === todayStr() && Array.isArray(cached.data)) return { data: cached.data, time: cached.time };
      }
    } catch {}
  }
  const data = await fetchFn();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ date: todayStr(), data, time })); } catch {}
  return { data, time };
}

function numAvg(values) {
  const valid = values.filter(v => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function fmtNum(n, decimals = 0) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const ExchangeRatesScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, ff, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(ff, fs), [ff, fs]);

  const [activeTab, setActiveTab] = useState('exchange');

  // FX state
  const [fxSources,    setFxSources]    = useState([]);
  const [fxTime,       setFxTime]       = useState(null);
  const [fxLoading,    setFxLoading]    = useState(true);
  const [fxRefreshing, setFxRefreshing] = useState(false);

  // Gold state
  const [goldSources,    setGoldSources]    = useState([]);
  const [goldTime,       setGoldTime]       = useState(null);
  const [goldLoading,    setGoldLoading]    = useState(false);
  const [goldRefreshing, setGoldRefreshing] = useState(false);
  const goldLoadedRef = useRef(false);

  // ── Load FX ───────────────────────────────────────────────────────────────
  const loadFX = useCallback(async (force = false) => {
    try {
      const { data, time } = await loadCached(FX_CACHE, force, () => fetchSources(FX_SOURCES));
      setFxSources(data);
      setFxTime(time);
    } catch {}
  }, []);

  useEffect(() => {
    setFxLoading(true);
    loadFX(false).finally(() => setFxLoading(false));
  }, []);

  // ── Load Gold (lazy — only on first tab visit) ────────────────────────────
  const loadGold = useCallback(async (force = false) => {
    try {
      const { data, time } = await loadCached(GOLD_CACHE, force, () => fetchSources(GOLD_SOURCES));
      setGoldSources(data);
      setGoldTime(time);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === 'gold' && !goldLoadedRef.current) {
      goldLoadedRef.current = true;
      setGoldLoading(true);
      loadGold(false).finally(() => setGoldLoading(false));
    }
  }, [activeTab]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    if (activeTab === 'exchange') {
      setFxRefreshing(true);
      await loadFX(true);
      setFxRefreshing(false);
    } else {
      setGoldRefreshing(true);
      await loadGold(true);
      setGoldRefreshing(false);
    }
  }, [activeTab, loadFX, loadGold]);

  const isRefreshing = activeTab === 'exchange' ? fxRefreshing : goldRefreshing;
  const updatedTime  = activeTab === 'exchange' ? fxTime : goldTime;

  // ─── Exchange Rate rendering ──────────────────────────────────────────────

  const renderFxPairCard = (pair) => {
    const vals = fxSources.map(s => s.parsed?.[pair.code]).filter(Boolean);
    const avgVal = numAvg(vals);

    return (
      <GlassCard key={pair.code} style={styles.card}>
        <View style={styles.cardInner}>
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

          {fxSources.map((src, idx) => {
            const val = src.parsed?.[pair.code];
            const isErr = src.error || !val;
            const isHigh = !isErr && fxSources.every(s => !s.parsed?.[pair.code] || s.parsed[pair.code] <= val);
            const isLow  = !isErr && fxSources.every(s => !s.parsed?.[pair.code] || s.parsed[pair.code] >= val);
            return (
              <View
                key={src.id}
                style={[styles.srcRow, idx < fxSources.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
              >
                <View style={styles.srcLeft}>
                  <Text style={[styles.srcName, { color: colors.text }, ff('500')]}>{src.name}</Text>
                  <View style={[styles.badge, { backgroundColor: src.badgeColor + '22' }]}>
                    <Text style={[styles.badgeText, { color: src.badgeColor }, ff('600')]}>{src.badge}</Text>
                  </View>
                </View>
                <View style={styles.srcRight}>
                  {isErr ? (
                    <Text style={[styles.errText, ff('500')]}>{t.error}</Text>
                  ) : (
                    <View style={styles.rateRow}>
                      <Text style={[styles.rateSymbol, { color: isHigh ? GREEN : colors.textMuted }, ff('600')]}>{pair.symbol}</Text>
                      <Text style={[styles.rateVal, { color: isHigh ? GREEN : colors.text }, ff('700')]}>{fmtNum(Math.round(val))}</Text>
                      {isHigh && !isLow && <Ionicons name="arrow-up"   size={12} color={GREEN}    style={{ marginLeft: 3 }} />}
                      {isLow  && !isHigh && <Ionicons name="arrow-down" size={12} color="#EF4444" style={{ marginLeft: 3 }} />}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {avgVal != null && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 4 }]} />
              <View style={styles.avgRow}>
                <Text style={[styles.avgLabel, { color: colors.textMuted }, ff('500')]}>{t.avg}</Text>
                <View style={styles.rateRow}>
                  <Text style={[styles.rateSymbol, { color: ACCENT }, ff('600')]}>{pair.symbol}</Text>
                  <Text style={[styles.avgVal, { color: ACCENT }, ff('800')]}>{fmtNum(Math.round(avgVal))}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </GlassCard>
    );
  };

  // ─── Gold rendering ───────────────────────────────────────────────────────

  const renderGold = () => {
    const ozVals  = goldSources.map(s => s.parsed?.usdPerOz).filter(Boolean);
    const avgOz   = numAvg(ozVals);
    const avgGram = avgOz != null ? avgOz / TROY_OZ : null;
    const avgChi  = avgGram != null ? avgGram * CHI_G : null;

    // KHR per gram from first available khrPerOz
    const khrPerOz = numAvg(goldSources.map(s => s.parsed?.khrPerOz).filter(Boolean));
    const khrPerGram = khrPerOz != null ? khrPerOz / TROY_OZ : null;

    return (
      <>
        {/* ── Source comparison card ── */}
        <GlassCard style={styles.card}>
          <View style={styles.cardInner}>
            <View style={styles.pairHeader}>
              <Text style={[styles.pairFlag]}>🥇</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pairCode, { color: colors.text }, ff('800')]}>{t.goldTitle}</Text>
                <Text style={[styles.pairName, { color: colors.textMuted }, ff('400')]}>{t.goldSub}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {goldSources.map((src, idx) => {
              const val = src.parsed?.usdPerOz;
              const isErr = src.error || !val;
              const isHigh = !isErr && goldSources.every(s => !s.parsed?.usdPerOz || s.parsed.usdPerOz <= val);
              const isLow  = !isErr && goldSources.every(s => !s.parsed?.usdPerOz || s.parsed.usdPerOz >= val);
              return (
                <View
                  key={src.id}
                  style={[styles.srcRow, idx < goldSources.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                >
                  <View style={styles.srcLeft}>
                    <Text style={[styles.srcName, { color: colors.text }, ff('500')]}>{src.name}</Text>
                    <View style={[styles.badge, { backgroundColor: src.badgeColor + '22' }]}>
                      <Text style={[styles.badgeText, { color: src.badgeColor }, ff('600')]}>{src.badge}</Text>
                    </View>
                  </View>
                  <View style={styles.srcRight}>
                    {isErr ? (
                      <Text style={[styles.errText, ff('500')]}>{t.error}</Text>
                    ) : (
                      <View style={styles.rateRow}>
                        <Text style={[styles.rateSymbol, { color: isHigh ? GREEN : colors.textMuted }, ff('600')]}>$</Text>
                        <Text style={[styles.rateVal, { color: isHigh ? GREEN : colors.text }, ff('700')]}>{fmtNum(Math.round(val))}</Text>
                        {isHigh && !isLow && <Ionicons name="arrow-up"   size={12} color={GREEN}    style={{ marginLeft: 3 }} />}
                        {isLow  && !isHigh && <Ionicons name="arrow-down" size={12} color="#EF4444" style={{ marginLeft: 3 }} />}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {avgOz != null && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 4 }]} />
                <View style={styles.avgRow}>
                  <Text style={[styles.avgLabel, { color: colors.textMuted }, ff('500')]}>{t.avg}</Text>
                  <View style={styles.rateRow}>
                    <Text style={[styles.rateSymbol, { color: GOLD_C }, ff('600')]}>$</Text>
                    <Text style={[styles.avgVal, { color: GOLD_C }, ff('800')]}>{fmtNum(Math.round(avgOz))}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </GlassCard>

        {/* ── Unit conversions card ── */}
        {avgOz != null && (
          <GlassCard style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.convHeader}>
                <Ionicons name="calculator-outline" size={15} color={GOLD_C} />
                <Text style={[styles.convTitle, { color: colors.text }, ff('700')]}>{t.conversions}</Text>
                <Text style={[styles.convNote, { color: colors.textMuted }, ff('400')]}>{t.convNote}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {[
                { label: t.perOz,   val: fmtNum(Math.round(avgOz),  0), symbol: '$', color: colors.text  },
                { label: t.perGram, val: fmtNum(avgGram, 2),            symbol: '$', color: colors.text  },
                { label: t.perChi,  val: fmtNum(avgChi,  2),            symbol: '$', color: colors.text  },
                khrPerGram != null
                  ? { label: t.perGramKHR, val: fmtNum(Math.round(khrPerGram), 0), symbol: '៛', color: '#F59E0B' }
                  : null,
              ].filter(Boolean).map((row, idx, arr) => (
                <View
                  key={row.label}
                  style={[
                    styles.convRow,
                    idx < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[styles.convLabel, { color: colors.textMuted }, ff('500')]}>{row.label}</Text>
                  <View style={styles.rateRow}>
                    <Text style={[styles.rateSymbol, { color: row.color }, ff('600')]}>{row.symbol}</Text>
                    <Text style={[styles.convVal, { color: row.color }, ff('700')]}>{row.val}</Text>
                  </View>
                </View>
              ))}
            </View>
          </GlassCard>
        )}
      </>
    );
  };

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  const skeletonBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const renderSkeleton = () => (
    <GlassCard style={styles.card}>
      <View style={styles.cardInner}>
        <View style={[styles.skBone, { width: 130, height: 18, marginBottom: 8, backgroundColor: skeletonBg }]} />
        <View style={[styles.skBone, { width: 90,  height: 13, marginBottom: 16, backgroundColor: skeletonBg }]} />
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.srcRow, i < 3 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={[styles.skBone, { flex: 1, height: 14, backgroundColor: skeletonBg }]} />
            <View style={[styles.skBone, { width: 80, height: 14, backgroundColor: skeletonBg }]} />
          </View>
        ))}
      </View>
    </GlassCard>
  );

  // ─── Source legend ────────────────────────────────────────────────────────

  const activeSources = activeTab === 'exchange' ? fxSources : goldSources;
  const activeLoading = activeTab === 'exchange' ? fxLoading : goldLoading;

  const renderLegend = () => (
    !activeLoading && (activeSources?.length ?? 0) > 0 ? (
      <View style={styles.legend}>
        {(activeSources ?? []).map(src => (
          <View key={src.id} style={[styles.legendItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <View style={[styles.legendDot, { backgroundColor: src.badgeColor }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }, ff('500')]}>{src.name}</Text>
          </View>
        ))}
      </View>
    ) : null
  );

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>

      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { color: colors.text }, ff('700')]}>{t.title}</Text>
            {updatedTime != null && (
              <Text style={[styles.headerSub, { color: colors.textMuted }, ff('400')]}>
                {t.updatedToday} {updatedTime}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            onPress={onRefresh}
            activeOpacity={0.7}
            disabled={isRefreshing}
          >
            {isRefreshing
              ? <ActivityIndicator size="small" color={ACCENT} />
              : <Ionicons name="refresh-outline" size={20} color={colors.text} />}
          </TouchableOpacity>
        </View>

        {/* Tab toggle */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {[
            { key: 'exchange', label: t.tabFX,   icon: 'swap-horizontal-outline' },
            { key: 'gold',     label: t.tabGold,  icon: 'ellipse-outline' },
          ].map(tab => {
            const active = activeTab === tab.key;
            const accentColor = tab.key === 'gold' ? GOLD_C : ACCENT;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabBtn,
                  active
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : { backgroundColor: 'transparent', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={active ? '#fff' : colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.tabLabel,
                  { color: active ? '#fff' : colors.textMuted },
                  ff(active ? '700' : '500'),
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
        }
      >
        {renderLegend()}

        {/* Exchange rate tab */}
        {activeTab === 'exchange' && (
          fxLoading
            ? <>{renderSkeleton()}{renderSkeleton()}</>
            : FX_PAIRS.map(renderFxPairCard)
        )}

        {/* Gold price tab */}
        {activeTab === 'gold' && (
          goldLoading
            ? <>{renderSkeleton()}{renderSkeleton()}</>
            : renderGold()
        )}
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
  backBtn:     { width: 40, alignItems: 'center', paddingVertical: 4 },
  refreshBtn:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs(17), lineHeight: 22, letterSpacing: 0 },
  headerSub:   { fontSize: fs(11), lineHeight: 15, letterSpacing: 0, marginTop: 1 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 12, borderWidth: 1,
  },
  tabLabel: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: fs(11), lineHeight: 15, letterSpacing: 0 },

  // Content
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  // Card
  card:      { marginBottom: 14 },
  cardInner: { padding: 16 },

  // Pair header
  pairHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pairFlag:   { fontSize: 28, lineHeight: 34 },
  pairCode:   { fontSize: fs(18), lineHeight: 23, letterSpacing: 0 },
  pairName:   { fontSize: fs(12), lineHeight: 17, letterSpacing: 0 },
  basePill:   { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  basePillText: { fontSize: fs(11), lineHeight: 15, letterSpacing: 0 },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 10 },

  // Source rows
  srcRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  srcLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  srcName:  { fontSize: fs(13), lineHeight: 18, letterSpacing: 0, flexShrink: 1 },
  badge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:{ fontSize: fs(10), lineHeight: 14, letterSpacing: 0 },
  srcRight: { flexShrink: 0, alignItems: 'flex-end' },
  rateRow:  { flexDirection: 'row', alignItems: 'center', gap: 1 },
  rateSymbol: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },
  rateVal:  { fontSize: fs(17), lineHeight: 22, letterSpacing: 0 },
  errText:  { fontSize: fs(12), lineHeight: 17, letterSpacing: 0, color: '#EF4444' },

  // Average row
  avgRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  avgLabel: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },
  avgVal:   { fontSize: fs(18), lineHeight: 23, letterSpacing: 0 },

  // Conversions card
  convHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  convTitle:  { fontSize: fs(14), lineHeight: 19, letterSpacing: 0, flex: 1 },
  convNote:   { fontSize: fs(11), lineHeight: 15, letterSpacing: 0 },
  convRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  convLabel:  { fontSize: fs(13), lineHeight: 18, letterSpacing: 0, flex: 1 },
  convVal:    { fontSize: fs(16), lineHeight: 21, letterSpacing: 0 },

  // Skeleton
  skBone: { borderRadius: 6, marginBottom: 4 },
});

export default ExchangeRatesScreen;
