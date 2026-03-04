/**
 * LOAN LIST SCREEN
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
import { formatCurrency, calcAccruedInterest, today } from '../../services/loanService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import GlassCard from '../../components/GlassCard';
import { Skeleton } from '../../components/Skeleton';

const ACCENT = '#6366F1';
const STATUS_COLORS = { active: '#10B981', overdue: '#EF4444', paid: '#9CA3AF', written_off: '#6B7280' };

const T = {
  en: {
    title: 'Loans',
    search: 'Search borrower...',
    empty: 'No loans yet',
    emptyHint: 'Create your first loan to get started',
    status: { active: 'Active', overdue: 'Overdue', paid: 'Paid', written_off: 'Written Off' },
    interestOnly: 'I/O',
    principalInterest: 'P+I',
    accruing: 'Accruing',
    filterAll: 'All',
    filterActive: 'Active',
    filterOverdue: 'Overdue',
    filterPaid: 'Paid',
    filterWrittenOff: 'Written Off',
  },
  km: {
    title: 'ប្រាក់កម្ចី',
    search: 'ស្វែងរកអ្នកខ្ចី...',
    empty: 'មិនទាន់មានប្រាក់កម្ចី',
    emptyHint: 'បង្កើតប្រាក់កម្ចីដំបូងរបស់អ្នក',
    status: { active: 'ដំណើរការ', overdue: 'ហួសកំណត់', paid: 'បានបង់', written_off: 'បោះបង់' },
    interestOnly: 'ការប្រាក់',
    principalInterest: 'ដើម+ការប្រាក់',
    accruing: 'បង្ហូរ',
    filterAll: 'ទាំងអស់',
    filterActive: 'ដំណើរការ',
    filterOverdue: 'ហួសកំណត់',
    filterPaid: 'បានបង់',
    filterWrittenOff: 'បោះបង់',
  },
};

const LoanListScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, fs, ff, fi } = useLanguage();
  const t = T[language] || T.en;
  const isKhmer = language === 'km';
  const styles = useMemo(() => makeStyles(fs, ff, isKhmer), [fs, ff, isKhmer]);

  const { loans, loansLoaded } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const loading = !loansLoaded;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const filtered = useMemo(() => {
    let result = loans;
    if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter);
    const q = search.toLowerCase().trim();
    if (q) result = result.filter(l => l.borrowerName?.toLowerCase().includes(q));
    return result;
  }, [loans, search, statusFilter]);

  const FILTERS = [
    { key: 'all',          label: t.filterAll,          color: ACCENT },
    { key: 'active',       label: t.filterActive,       color: '#10B981' },
    { key: 'overdue',      label: t.filterOverdue,      color: '#EF4444' },
    { key: 'paid',         label: t.filterPaid,         color: '#9CA3AF' },
    { key: 'written_off',  label: t.filterWrittenOff,   color: '#6B7280' },
  ];

  const renderItem = ({ item: loan }) => {
    const statusColor = STATUS_COLORS[loan.status] ?? STATUS_COLORS.active;
    const accrued = loan.scheduleMode === 'open' && loan.status !== 'paid' && loan.status !== 'written_off'
      ? calcAccruedInterest(loan)
      : null;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
        activeOpacity={0.8}
        style={styles.cardWrap}
      >
        <GlassCard>
          <View style={styles.loanRow}>
            <View style={styles.loanMain}>
              <View style={styles.topRow}>
                <Text style={[styles.borrowerName, { color: colors.text }]} numberOfLines={1}>
                  {loan.borrowerName}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{t.status[loan.status] ?? loan.status}</Text>
                </View>
              </View>

              <Text style={[styles.principal, { color: colors.text }]}>
                {formatCurrency(loan.currentPrincipal, loan.currency)}
              </Text>

              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {loan.interestRate}% · {loan.interestBasis} · {loan.repaymentType === 'interest_only' ? t.interestOnly : t.principalInterest}
                </Text>
                {accrued !== null && accrued > 0 && (
                  <Text style={styles.accruingText}>
                    {t.accruing}: {formatCurrency(accrued, loan.currency)}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t.title}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('LoanCalculator')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="calculator-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }, fi()]}
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, { backgroundColor: active ? f.color : f.color + '18', borderColor: f.color + '40' }]}
                onPress={() => setStatusFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, { color: active ? '#fff' : f.color }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
          {[1, 2, 3].map(i => (
            <GlassCard key={i}>
              <View style={{ padding: 16, gap: 8 }}>
                <Skeleton width="40%" height={13} isDark={isDark} />
                <Skeleton width="60%" height={18} isDark={isDark} />
                <Skeleton width="50%" height={11} isDark={isDark} />
              </View>
            </GlassCard>
          ))}
        </View>
      ) : (
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
              <Ionicons name="document-text-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>{t.empty}</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t.emptyHint}</Text>
            </View>
          }
        />
      )}

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

const makeStyles = (fs, ff, isKhmer = false) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  title: { fontSize: fs(28), ...(isKhmer ? {} : { lineHeight: 34 }), ...ff('800'), letterSpacing: 0 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, height: 44, borderRadius: 14, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: fs(15), lineHeight: 20, ...ff('400') },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: fs(13), lineHeight: 18, ...ff('700') },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 8 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  cardWrap: {},
  loanRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  loanMain: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  borrowerName: { flex: 1, fontSize: fs(15), lineHeight: 20, ...ff('600') },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: fs(11), ...(isKhmer ? {} : { lineHeight: 15 }), ...ff('700') },
  principal: { fontSize: fs(20), lineHeight: 26, ...ff('800'), marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  meta: { fontSize: fs(13), lineHeight: 18, ...ff('400') },
  accruingText: { fontSize: fs(12), lineHeight: 16, color: '#F59E0B', ...ff('600') },
  emptyWrap: { alignItems: 'center', gap: 10, paddingBottom: 80 },
  emptyText: { fontSize: fs(17), lineHeight: 22, ...ff('600') },
  emptyHint: { fontSize: fs(14), lineHeight: 19, ...ff('400') },
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

export default LoanListScreen;
