/**
 * BORROWER LIST SCREEN
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import { formatCurrency } from '../../services/loanService';
import GlassCard from '../../components/GlassCard';
import { Skeleton } from '../../components/Skeleton';

const ACCENT = '#00C2B2';
const RED    = '#EF4444';

const AVATAR_COLORS = ['#00C2B2','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#14B8A6'];
function avatarColor(name) {
  if (!name) return ACCENT;
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const FILTERS = ['all', 'active', 'overdue', 'noLoans'];
const SORTS   = ['nameAsc', 'outstandingDesc', 'loansDesc'];

const T = {
  en: {
    title: 'Borrowers',
    search: 'Search name or phone...',
    empty: 'No borrowers yet',
    emptyHint: 'Add your first borrower to get started',
    activeLoans: (n) => `${n} loan${n !== 1 ? 's' : ''}`,
    noLoans: 'No active loans',
    outstanding: 'Outstanding',
    borrowerCount: (n) => `${n} borrower${n !== 1 ? 's' : ''}`,
    // Filters
    filterAll:     'All',
    filterActive:  'Active',
    filterOverdue: 'Overdue',
    filterNoLoans: 'No Loans',
    // Sort
    sortNameAsc:        'Name A→Z',
    sortOutstandingDesc:'Amount ↓',
    sortLoansDesc:      'Loans ↓',
  },
  km: {
    title: 'អតិថិជន',
    search: 'ស្វែងរកឈ្មោះ ឬលេខទូរសព្ទ...',
    empty: 'មិនទាន់មានអតិថិជនទេ',
    emptyHint: 'បន្ថែមអតិថិជនដំបូងរបស់អ្នក',
    activeLoans: (n) => `${n} កម្ចី`,
    noLoans: 'គ្មានកម្ចី',
    outstanding: 'កម្ចីដែលបានផ្តល់',
    borrowerCount: (n) => `${n} នាក់`,
    // Filters
    filterAll:     'ទាំងអស់',
    filterActive:  'ដំណើរការ',
    filterOverdue: 'ហួសកំណត់',
    filterNoLoans: 'គ្មានកម្ចី',
    // Sort
    sortNameAsc:        'ឈ្មោះ ក→ឬ',
    sortOutstandingDesc:'ចំនួន ↓',
    sortLoansDesc:      'កម្ចី ↓',
  },
};

const BorrowerListScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, fs, ff, fi } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff), [fs, ff]);

  const { borrowers, loans, borrowersLoaded } = useData();
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [sort, setSort]         = useState('nameAsc');
  const [refreshing, setRefreshing] = useState(false);
  const loading = !borrowersLoaded;

  const cycleSort = () => {
    const idx = SORTS.indexOf(sort);
    setSort(SORTS[(idx + 1) % SORTS.length]);
  };

  const sortLabel = {
    nameAsc:        t.sortNameAsc,
    outstandingDesc:t.sortOutstandingDesc,
    loansDesc:      t.sortLoansDesc,
  }[sort];

  // Build per-borrower stats (active + overdue)
  const borrowerStats = useMemo(() => {
    const map = {};
    for (const loan of loans) {
      if (!map[loan.borrowerId]) {
        map[loan.borrowerId] = { activeCount: 0, overdueCount: 0, outstanding: 0, currency: loan.currency ?? 'USD' };
      }
      if (loan.status === 'active' || loan.status === 'overdue') {
        map[loan.borrowerId].activeCount++;
        map[loan.borrowerId].outstanding += loan.currentPrincipal ?? 0;
        map[loan.borrowerId].currency = loan.currency ?? map[loan.borrowerId].currency;
        if (loan.status === 'overdue') map[loan.borrowerId].overdueCount++;
      }
    }
    return map;
  }, [loans]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  // Filter → sort pipeline
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = borrowers;

    // Search
    if (q) result = result.filter(b =>
      b.name.toLowerCase().includes(q) || (b.phone || '').includes(q)
    );

    // Filter
    if (filter === 'active')  result = result.filter(b => (borrowerStats[b.id]?.activeCount ?? 0) > 0);
    if (filter === 'overdue') result = result.filter(b => (borrowerStats[b.id]?.overdueCount ?? 0) > 0);
    if (filter === 'noLoans') result = result.filter(b => (borrowerStats[b.id]?.activeCount ?? 0) === 0);

    // Sort
    result = [...result];
    if (sort === 'nameAsc')         result.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'outstandingDesc') result.sort((a, b) => (borrowerStats[b.id]?.outstanding ?? 0) - (borrowerStats[a.id]?.outstanding ?? 0));
    if (sort === 'loansDesc')       result.sort((a, b) => (borrowerStats[b.id]?.activeCount ?? 0) - (borrowerStats[a.id]?.activeCount ?? 0));

    return result;
  }, [borrowers, search, filter, sort, borrowerStats]);

  const filterLabels = {
    all:     t.filterAll,
    active:  t.filterActive,
    overdue: t.filterOverdue,
    noLoans: t.filterNoLoans,
  };

  const renderItem = ({ item }) => {
    const stats   = borrowerStats[item.id] ?? { activeCount: 0, overdueCount: 0, outstanding: 0, currency: 'USD' };
    const aColor  = avatarColor(item.name);
    const hasActive  = stats.activeCount > 0;
    const hasOverdue = stats.overdueCount > 0;
    const rowColor   = hasOverdue ? RED : aColor;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('BorrowerDetail', { borrowerId: item.id })}
        activeOpacity={0.8}
        style={styles.cardWrap}
      >
        <GlassCard>
          <View style={styles.cardRow}>
            {/* Avatar */}
            {item.photoURL ? (
              <View style={[styles.avatar, { overflow: 'hidden' }]}>
                <Image source={{ uri: item.photoURL }} style={styles.avatarImg} />
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: rowColor + '22' }]}>
                <Text style={[styles.avatarText, { color: rowColor }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Info */}
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              {item.phone ? (
                <Text style={[styles.phone, { color: colors.textMuted }]}>{item.phone}</Text>
              ) : null}
            </View>

            {/* Stats */}
            <View style={styles.statsCol}>
              {hasActive ? (
                <>
                  <Text style={[styles.outstandingAmt, { color: rowColor }]}>
                    {formatCurrency(stats.outstanding, stats.currency)}
                  </Text>
                  <View style={[styles.loanCountChip, { backgroundColor: rowColor + '18' }]}>
                    <Text style={[styles.loanCountText, { color: rowColor }]}>
                      {t.activeLoans(stats.activeCount)}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.noLoansText, { color: colors.textMuted }]}>{t.noLoans}</Text>
              )}
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = () => (
    <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
      {[1, 2, 3].map(i => (
        <GlassCard key={i}>
          <View style={[styles.cardRow, { paddingVertical: 16 }]}>
            <Skeleton width={48} height={48} radius={24} isDark={isDark} />
            <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
              <Skeleton width="50%" height={14} isDark={isDark} />
              <Skeleton width="35%" height={11} isDark={isDark} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Skeleton width={64} height={14} isDark={isDark} />
              <Skeleton width={80} height={20} isDark={isDark} radius={10} />
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );

  const pillBg = (active) => active
    ? ACCENT
    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t.title}</Text>
            {!loading && borrowers.length > 0 && (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t.borrowerCount(filtered.length)}
              </Text>
            )}
          </View>
          {/* Sort button */}
          <TouchableOpacity
            style={[styles.sortBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            onPress={cycleSort}
            activeOpacity={0.7}
          >
            <Ionicons name="funnel-outline" size={14} color={ACCENT} />
            <Text style={[styles.sortBtnText, { color: ACCENT }, ff('600')]}>{sortLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }, fi()]}
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, { backgroundColor: pillBg(active) }]}
                onPress={() => setFilter(f)}
                activeOpacity={0.7}
              >
                {f === 'overdue' && (
                  <View style={[styles.filterDot, { backgroundColor: active ? '#fff' : RED }]} />
                )}
                <Text style={[styles.filterPillText, { color: active ? '#fff' : colors.textMuted }, ff(active ? '600' : '400')]}>
                  {filterLabels[f]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

      </SafeAreaView>

      {loading ? renderSkeleton() : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: ACCENT + '15' }]}>
                <Ionicons name="people-outline" size={36} color={ACCENT} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>{t.empty}</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t.emptyHint}</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={() => navigation.navigate('CreateBorrower')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (fs, ff) => StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: fs(28), lineHeight: 40, ...ff('600'), letterSpacing: 0 },
  subtitle: { fontSize: fs(13), lineHeight: 18, ...ff('400'), marginTop: 1 },

  // Sort button
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  sortBtnText: { fontSize: fs(12), lineHeight: 17, letterSpacing: 0 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 0,
    paddingHorizontal: 14, height: 44, borderRadius: 14, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: fs(15), lineHeight: 20, ...ff('400') },

  // Filter pills
  filterBar: { marginTop: 10 },
  filterBarContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', paddingBottom: 4 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterPillText: { fontSize: fs(13), lineHeight: 18, letterSpacing: 0 },
  filterDot: { width: 6, height: 6, borderRadius: 3 },

  // List
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100, gap: 8 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  cardWrap: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg: { width: 48, height: 48 },
  avatarText: { fontSize: fs(20), lineHeight: 26, ...ff('600'), textAlign: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: fs(14), lineHeight: 19, ...ff('400'), marginBottom: 2 },
  phone: { fontSize: fs(13), lineHeight: 18, ...ff('400') },
  statsCol: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  outstandingAmt: { fontSize: fs(14), lineHeight: 19, ...ff('400') },
  loanCountChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  loanCountText: { fontSize: fs(11), lineHeight: 21, ...ff('400') },
  noLoansText: { fontSize: fs(12), lineHeight: 16, ...ff('400') },

  // Empty
  emptyWrap: { alignItems: 'center', gap: 12, paddingBottom: 80 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText: { fontSize: fs(17), lineHeight: 22, ...ff('600') },
  emptyHint: { fontSize: fs(14), lineHeight: 19, ...ff('400') },

  // FAB
  fab: {
    position: 'absolute', right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
});

export default BorrowerListScreen;
