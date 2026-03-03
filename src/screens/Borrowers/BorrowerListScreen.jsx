/**
 * BORROWER LIST SCREEN
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
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

const ACCENT = '#6366F1';

// Palette of accent colors for avatars — cycles by first-letter charCode
const AVATAR_COLORS = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#14B8A6'];
function avatarColor(name) {
  if (!name) return ACCENT;
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const T = {
  en: {
    title: 'Borrowers',
    search: 'Search name or phone...',
    empty: 'No borrowers yet',
    emptyHint: 'Add your first borrower to get started',
    activeLoans: (n) => `${n} active loan${n !== 1 ? 's' : ''}`,
    noLoans: 'No active loans',
    outstanding: 'Outstanding',
    borrowerCount: (n) => `${n} borrower${n !== 1 ? 's' : ''}`,
  },
  km: {
    title: 'អ្នកខ្ចី',
    search: 'ស្វែងរកឈ្មោះ ឬលេខទូរសព្ទ...',
    empty: 'មិនទាន់មានអ្នកខ្ចីទេ',
    emptyHint: 'បន្ថែមអ្នកខ្ចីដំបូងរបស់អ្នក',
    activeLoans: (n) => `${n} ប្រាក់កម្ចី`,
    noLoans: 'គ្មានប្រាក់កម្ចី',
    outstanding: 'នៅជំពាក់',
    borrowerCount: (n) => `${n} នាក់`,
  },
};

const BorrowerListScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, fs, ff, fi } = useLanguage();
  const t = T[language] || T.en;
  const isKhmer = language === 'km';
  const styles = useMemo(() => makeStyles(fs, ff, isKhmer), [fs, ff, isKhmer]);

  const { borrowers, loans, borrowersLoaded } = useData();
  const [search, setSearch] = useState('');
  const loading = !borrowersLoaded;
  const [refreshing, setRefreshing] = useState(false);

  // Build per-borrower stats
  const borrowerStats = useMemo(() => {
    const map = {};
    for (const loan of loans) {
      if (!map[loan.borrowerId]) {
        map[loan.borrowerId] = { activeCount: 0, outstanding: 0, currency: loan.currency ?? 'USD' };
      }
      if (loan.status !== 'paid') {
        map[loan.borrowerId].activeCount++;
        map[loan.borrowerId].outstanding += loan.currentPrincipal ?? 0;
        map[loan.borrowerId].currency = loan.currency ?? map[loan.borrowerId].currency;
      }
    }
    return map;
  }, [loans]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return borrowers;
    return borrowers.filter(b =>
      b.name.toLowerCase().includes(q) || (b.phone || '').includes(q)
    );
  }, [borrowers, search]);

  const renderItem = ({ item }) => {
    const stats = borrowerStats[item.id] ?? { activeCount: 0, outstanding: 0, currency: 'USD' };
    const aColor = avatarColor(item.name);
    const hasActive = stats.activeCount > 0;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('BorrowerDetail', { borrowerId: item.id })}
        activeOpacity={0.8}
        style={styles.cardWrap}
      >
        <GlassCard>
          <View style={styles.cardRow}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: aColor + '22' }]}>
              <Text style={[styles.avatarText, { color: aColor }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>

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
                  <Text style={[styles.outstandingAmt, { color: aColor }]}>
                    {formatCurrency(stats.outstanding, stats.currency)}
                  </Text>
                  <View style={[styles.loanCountChip, { backgroundColor: aColor + '18' }]}>
                    <Text style={[styles.loanCountText, { color: aColor }]}>
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

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t.title}</Text>
            {!loading && borrowers.length > 0 && (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t.borrowerCount(filtered.length)}
              </Text>
            )}
          </View>
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
      </SafeAreaView>

      {loading ? renderSkeleton() : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
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

const makeStyles = (fs, ff, isKhmer = false) => StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: fs(28), lineHeight: 34, ...ff('800'), letterSpacing: 0 },
  subtitle: { fontSize: fs(13), lineHeight: 18, ...ff('500'), marginTop: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, height: 44, borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: fs(15), lineHeight: 20, ...ff('400') },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 8 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  cardWrap: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: fs(20), lineHeight: 26, ...ff('800'), textAlign: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: fs(15), lineHeight: 20, ...ff('600'), marginBottom: 2 },
  phone: { fontSize: fs(13), lineHeight: 18, ...ff('400') },
  statsCol: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  outstandingAmt: { fontSize: fs(14), lineHeight: 19, ...ff('700') },
  loanCountChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  loanCountText: { fontSize: fs(11), ...(isKhmer ? {} : { lineHeight: 15 }), ...ff('700') },
  noLoansText: { fontSize: fs(12), lineHeight: 16, ...ff('500') },
  emptyWrap: { alignItems: 'center', gap: 12, paddingBottom: 80 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText: { fontSize: fs(17), lineHeight: 22, ...ff('600') },
  emptyHint: { fontSize: fs(14), lineHeight: 19, ...ff('400') },
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
