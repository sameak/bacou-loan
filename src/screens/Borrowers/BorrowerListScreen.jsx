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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import { Skeleton } from '../../components/Skeleton';

const ACCENT = '#6366F1';

const T = {
  en: {
    title: 'Borrowers',
    search: 'Search name or phone...',
    empty: 'No borrowers yet',
    emptyHint: 'Add your first borrower to get started',
    activeLoans: (n) => `${n} active loan${n !== 1 ? 's' : ''}`,
    noLoans: 'No active loans',
    outstanding: 'Outstanding',
  },
  km: {
    title: 'អ្នកខ្ចី',
    search: 'ស្វែងរកឈ្មោះ ឬលេខទូរសព្ទ...',
    empty: 'មិនទាន់មានអ្នកខ្ចីទេ',
    emptyHint: 'បន្ថែមអ្នកខ្ចីដំបូងរបស់អ្នក',
    activeLoans: (n) => `${n} ប្រាក់កម្ចី`,
    noLoans: 'គ្មានប្រាក់កម្ចី',
    outstanding: 'នៅជំពាក់',
  },
};

const BorrowerListScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language, fs } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs), [fs]);

  const { borrowers, loans, borrowersLoaded } = useData();
  const [search, setSearch] = useState('');
  const loading = !borrowersLoaded;
  const [refreshing, setRefreshing] = useState(false);

  // Build per-borrower stats
  const borrowerStats = useMemo(() => {
    const map = {};
    for (const loan of loans) {
      if (!map[loan.borrowerId]) {
        map[loan.borrowerId] = { activeCount: 0, outstanding: 0 };
      }
      if (loan.status !== 'paid') {
        map[loan.borrowerId].activeCount++;
        map[loan.borrowerId].outstanding += loan.currentPrincipal ?? 0;
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
    const stats = borrowerStats[item.id] ?? { activeCount: 0, outstanding: 0 };
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('BorrowerDetail', { borrowerId: item.id })}
        activeOpacity={0.8}
        style={styles.cardWrap}
      >
        <GlassCard>
          <View style={styles.cardRow}>
            <View style={[styles.avatar, { backgroundColor: ACCENT + '20' }]}>
              <Text style={[styles.avatarText, { color: ACCENT }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.phone, { color: colors.textMuted }]}>{item.phone}</Text>
            </View>
            <View style={styles.stats}>
              {stats.activeCount > 0 ? (
                <>
                  <Text style={[styles.statCount, { color: ACCENT }]}>{t.activeLoans(stats.activeCount)}</Text>
                  {stats.outstanding > 0 && (
                    <Text style={[styles.statAmount, { color: colors.textMuted }]}>
                      {stats.outstanding.toLocaleString()}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={[styles.statCount, { color: colors.textMuted }]}>{t.noLoans}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
            <Skeleton width={44} height={44} radius={22} isDark={isDark} />
            <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
              <Skeleton width="50%" height={14} isDark={isDark} />
              <Skeleton width="35%" height={11} isDark={isDark} />
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
          <Text style={[styles.title, { color: colors.text }]}>{t.title}</Text>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>{t.empty}</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t.emptyHint}</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateBorrower')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (fs) => StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: fs(28), fontWeight: '800', letterSpacing: -0.5 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, height: 44, borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: fs(15), fontWeight: '400' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 8 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  cardWrap: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fs(18), fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: fs(15), fontWeight: '600', marginBottom: 2 },
  phone: { fontSize: fs(13), fontWeight: '400' },
  stats: { alignItems: 'flex-end' },
  statCount: { fontSize: fs(12), fontWeight: '600' },
  statAmount: { fontSize: fs(12), fontWeight: '400' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingBottom: 80 },
  emptyText: { fontSize: fs(17), fontWeight: '600' },
  emptyHint: { fontSize: fs(14) },
  fab: {
    position: 'absolute', bottom: 28, right: 24,
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
