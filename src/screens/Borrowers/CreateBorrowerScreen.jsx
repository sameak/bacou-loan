/**
 * CREATE BORROWER SCREEN — Modal bottom sheet
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { createBorrower, updateBorrower } from '../../services/borrowerService';
import { uploadProfilePhoto } from '../../services/borrowerFilesService';
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
    tapToAdd: 'Tap to add photo',
    socialLinks: 'Social Links',
    facebookPlaceholder: 'Facebook username or URL',
    telegramPlaceholder: 'Telegram @username',
    whatsappPlaceholder: 'WhatsApp +855...',
    instagramPlaceholder: 'Instagram @username',
    save: 'Save Borrower',
    cancel: 'Cancel',
    errName: 'Name is required',
    saved: 'Borrower added successfully',
  },
  km: {
    title: 'អតិថិជនថ្មី',
    name: 'ឈ្មោះពេញ',
    namePlaceholder: 'ឧ. ចន ស្មីត',
    phone: 'លេខទូរសព្ទ',
    phonePlaceholder: '+855 12 345 678',
    address: 'អាសយដ្ឋាន',
    addressPlaceholder: 'ភូមិ ស្រុក ខេត្ត',
    notes: 'កំណត់ចំណាំ',
    notesPlaceholder: 'ព័ត៌មានបន្ថែម...',
    tapToAdd: 'ចុចដើម្បីបន្ថែមរូបភាព',
    socialLinks: 'ទំនាក់ទំនងបន្ថែម',
    facebookPlaceholder: 'ឈ្មោះ ឬ URL',
    telegramPlaceholder: 'ឈ្មោះ Telegram',
    whatsappPlaceholder: 'WhatsApp +855...',
    instagramPlaceholder: 'ឈ្មោះ Instagram',
    save: 'រក្សាទុក',
    cancel: 'បោះបង់',
    errName: 'ទាមតារឈ្មោះ',
    saved: 'បានបន្ថែមអតិថិជនដោយជោគជ័យ',
  },
};

const ACCENT = '#00C2B2';

const SOCIAL_META = [
  { key: 'facebook',  icon: 'logo-facebook',      color: '#1877F2' },
  { key: 'telegram',  icon: 'paper-plane-outline', color: '#2AABEE' },
  { key: 'whatsapp',  icon: 'logo-whatsapp',       color: '#25D366' },
  { key: 'instagram', icon: 'logo-instagram',      color: '#E1306C' },
];

const CreateBorrowerScreen = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { language, fs, ff, fi } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff, language), [fs, ff, language]);
  const scrollRef = useRef(null);

  const prefill = route?.params?.prefill ?? {};

  const [name, setName] = useState(prefill.name ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [socialLinks, setSocialLinks] = useState({ facebook: '', telegram: '', whatsapp: '', instagram: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const inputBg = isDark ? colors.surface : '#F2F4F8';
  const inputStyle = [styles.input, { backgroundColor: inputBg, color: colors.text }];
  const multilineStyle = [styles.input, styles.multiline, { backgroundColor: inputBg, color: colors.text }];

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = t.errName;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickPhoto = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Toast.show({ text: 'Photo library permission denied', type: 'error' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const hasSocial = Object.values(socialLinks).some(v => v.trim());
      const borrower = await createBorrower({
        name, phone, address, notes,
        ...(hasSocial ? { socialLinks } : {}),
      });

      if (photoUri) {
        try {
          const url = await uploadProfilePhoto(borrower.id, photoUri);
          await updateBorrower(borrower.id, { photoURL: url });
          borrower.photoURL = url;
        } catch (photoErr) {
          console.warn('Profile photo upload failed:', photoErr.message);
        }
      }

      Toast.show({ text: t.saved, type: 'success' });
      if (route?.params?.onCreated) route.params.onCreated(borrower);
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
          {/* Profile photo */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.photoBtn}>
              {photoUri ? (
                <View style={styles.photoCircleWrap}>
                  <Image source={{ uri: photoUri }} style={styles.photoCircleImg} />
                </View>
              ) : (
                <View style={[styles.photoCircleWrap, { backgroundColor: ACCENT + '18' }]}>
                  <Ionicons name="person-outline" size={36} color={ACCENT} />
                </View>
              )}
              <View style={[styles.photoCamBadge, { backgroundColor: ACCENT }]}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.photoHint, { color: colors.textMuted }]}>{t.tapToAdd}</Text>
          </View>

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
            style={[inputStyle, fi()]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t.phonePlaceholder}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />

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

          {/* Social Links */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>{t.socialLinks.toUpperCase()}</Text>
          {SOCIAL_META.map(({ key, icon, color }) => (
            <View key={key} style={[styles.socialRow, { backgroundColor: inputBg, marginBottom: 8 }]}>
              <View style={[styles.socialIcon, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon} size={18} color={color} />
              </View>
              <TextInput
                style={[styles.socialInput, { color: colors.text, fontSize: fs(15) }, fi()]}
                value={socialLinks[key]}
                onChangeText={v => setSocialLinks(prev => ({ ...prev, [key]: v }))}
                placeholder={t[`${key}Placeholder`]}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </View>
          ))}
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

const makeStyles = (fs, ff, language) => {
  const km = true;
  return StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 64, paddingVertical: 4 },
  headerBtnText: { fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0, ...ff('400') },
  headerTitle: { fontSize: fs(18), lineHeight: km ? 38 : 29, letterSpacing: 0, ...ff('600') },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 80 },
  label: { fontSize: fs(11), lineHeight: km ? 20 : 15, letterSpacing: 0, ...ff('600'), marginBottom: 8, marginTop: 4 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: fs(15), lineHeight: km ? 26 : 20, letterSpacing: 0, ...ff('400'), marginBottom: 4 },
  multiline: { height: 90, paddingTop: 14 },
  inputError: { borderWidth: 1.5, borderColor: '#EF4444' },
  errText: { fontSize: fs(12), lineHeight: km ? 21 : 16, letterSpacing: 0, color: '#EF4444', marginBottom: 8, marginLeft: 4 },
  // Photo
  photoSection: { alignItems: 'center', marginBottom: 24 },
  photoBtn: { position: 'relative', marginBottom: 8 },
  photoCircleWrap: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoCircleImg: { width: 88, height: 88 },
  photoCamBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { fontSize: fs(12), lineHeight: km ? 21 : 16, letterSpacing: 0, ...ff('400') },
  // Social
  socialRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, overflow: 'hidden' },
  socialIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  socialInput: { flex: 1, height: 52, paddingHorizontal: 12, lineHeight: km ? 26 : 20, letterSpacing: 0, ...ff('400') },
  // Footer
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: {
    height: 56, borderRadius: 16, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: fs(16), lineHeight: km ? 27 : 21, letterSpacing: 0, ...ff('600') },
});
};

export default CreateBorrowerScreen;
