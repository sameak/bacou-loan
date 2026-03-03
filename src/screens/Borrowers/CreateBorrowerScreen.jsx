/**
 * CREATE BORROWER SCREEN — Modal bottom sheet
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBorrower } from '../../services/borrowerService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Toast from '../../components/Toast';

const T = {
  en: {
    title: 'New Borrower',
    name: 'Full Name',
    namePlaceholder: 'e.g. John Smith',
    phone: 'Phone Number',
    phonePlaceholder: '+855 12 345 678',
    address: 'Address (optional)',
    addressPlaceholder: 'Village, District, Province',
    notes: 'Notes (optional)',
    notesPlaceholder: 'Any additional information...',
    save: 'Save Borrower',
    cancel: 'Cancel',
    errName: 'Name is required',
    errPhone: 'Phone number is required',
    saved: 'Borrower added successfully',
  },
  km: {
    title: 'អ្នកខ្ចីថ្មី',
    name: 'ឈ្មោះពេញ',
    namePlaceholder: 'ឧ. ចន ស្មីត',
    phone: 'លេខទូរសព្ទ',
    phonePlaceholder: '+855 12 345 678',
    address: 'អាសយដ្ឋាន (ស្រេចចិត្ត)',
    addressPlaceholder: 'ភូមិ ស្រុក ខេត្ត',
    notes: 'កំណត់ចំណាំ (ស្រេចចិត្ត)',
    notesPlaceholder: 'ព័ត៌មានបន្ថែម...',
    save: 'រក្សាទុក',
    cancel: 'បោះបង់',
    errName: 'ទាមតារឈ្មោះ',
    errPhone: 'ទាមតារលេខទូរសព្ទ',
    saved: 'បានបន្ថែមអ្នកខ្ចីដោយជោគជ័យ',
  },
};

const ACCENT = '#6366F1';

const CreateBorrowerScreen = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { language, ff, fi } = useLanguage();
  const t = T[language] || T.en;

  const styles = useMemo(() => makeStyles(ff), [ff]);
  const scrollRef = useRef(null);

  // Allow pre-filling from BorrowerDetail → "New Loan" flow
  const prefill = route?.params?.prefill ?? {};

  const [name, setName] = useState(prefill.name ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const inputBg = isDark ? colors.surface : '#F2F4F8';
  const inputStyle = [styles.input, { backgroundColor: inputBg, color: colors.text }];
  const multilineStyle = [styles.input, styles.multiline, { backgroundColor: inputBg, color: colors.text }];

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = t.errName;
    if (!phone.trim()) e.phone = t.errPhone;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const borrower = await createBorrower({ name, phone, address, notes });
      Toast.show({ text: t.saved, type: 'success' });
      // Pass created borrower back if caller needs it
      if (route?.params?.onCreated) {
        route.params.onCreated(borrower);
      }
      navigation.goBack();
    } catch (err) {
      Toast.show({ text: err.message || 'Failed to save', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <SafeAreaView edges={['top']}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
              <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>{t.cancel}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t.title}</Text>
            <View style={{ width: 64 }} />
          </View>
        </SafeAreaView>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Name */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.name.toUpperCase()}</Text>
          <TextInput
            style={[inputStyle, errors.name && styles.inputError, fi()]}
            value={name}
            onChangeText={v => { setName(v); if (errors.name) setErrors(e => ({ ...e, name: null })); }}
            placeholder={t.namePlaceholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          {errors.name ? <Text style={styles.errText}>{errors.name}</Text> : null}

          {/* Phone */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.phone.toUpperCase()}</Text>
          <TextInput
            style={[inputStyle, errors.phone && styles.inputError, fi()]}
            value={phone}
            onChangeText={v => { setPhone(v); if (errors.phone) setErrors(e => ({ ...e, phone: null })); }}
            placeholder={t.phonePlaceholder}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
          {errors.phone ? <Text style={styles.errText}>{errors.phone}</Text> : null}

          {/* Address */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.address.toUpperCase()}</Text>
          <TextInput
            style={[inputStyle, fi()]}
            value={address}
            onChangeText={setAddress}
            placeholder={t.addressPlaceholder}
            placeholderTextColor={colors.textMuted}
          />

          {/* Notes */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t.notes.toUpperCase()}</Text>
          <TextInput
            style={[multilineStyle, fi()]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notesPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)}
          />
        </ScrollView>

        {/* Save button */}
        <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>{t.save}</Text>
            }
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (ff) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 64, paddingVertical: 4 },
  headerBtnText: { fontSize: 15, ...ff('500') },
  headerTitle: { fontSize: 18, ...ff('700') },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 80 },
  label: { fontSize: 11, ...ff('700'), letterSpacing: 0, marginBottom: 8, marginTop: 4 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, ...ff('400'), marginBottom: 4 },
  multiline: { height: 90, paddingTop: 14 },
  inputError: { borderWidth: 1.5, borderColor: '#EF4444' },
  errText: { fontSize: 12, color: '#EF4444', marginBottom: 8, marginLeft: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: {
    height: 56, borderRadius: 16, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  saveBtnText: { color: '#fff', fontSize: 16, ...ff('700') },
});

export default CreateBorrowerScreen;
