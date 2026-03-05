/**
 * BORROWER DETAIL SCREEN
 * Tabs: Loans · Payments · Files
 */

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateBorrower, deleteBorrower, listenBorrowers, mergeBorrowers, getBorrowers } from '../../services/borrowerService';
import { listenLoansByBorrower, getLoansByBorrower, deleteLoan, formatCurrency, calcAccruedInterest, getBorrowerPayments } from '../../services/loanService';
import { uploadBorrowerFile, listenBorrowerFiles, deleteBorrowerFile, uploadProfilePhoto } from '../../services/borrowerFilesService';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';

const ACCENT = '#00C2B2';
const STATUS_COLORS = { active: '#10B981', overdue: '#EF4444', paid: '#9CA3AF', written_off: '#6B7280' };
const SCREEN_W = Dimensions.get('window').width;

const AVATAR_COLORS = ['#00C2B2','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#14B8A6'];
function avatarColor(name) {
  if (!name) return ACCENT;
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function isSimilarName(a, b) {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return true;
  if (la.includes(lb) || lb.includes(la)) return true;
  const wa = la.split(/\s+/)[0];
  const wb = lb.split(/\s+/)[0];
  return wa.length >= 2 && wa === wb;
}

const SOCIAL_META = [
  { key: 'facebook',  icon: 'logo-facebook',      color: '#1877F2' },
  { key: 'telegram',  icon: 'paper-plane-outline', color: '#2AABEE' },
  { key: 'whatsapp',  icon: 'logo-whatsapp',       color: '#25D366' },
  { key: 'instagram', icon: 'logo-instagram',      color: '#E1306C' },
];

function isImage(mimeType) {
  return mimeType?.startsWith('image/');
}
function isVideo(mimeType) {
  return mimeType?.startsWith('video/');
}
function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fileIcon(mimeType) {
  if (isImage(mimeType)) return 'image-outline';
  if (isVideo(mimeType)) return 'videocam-outline';
  if (mimeType?.includes('pdf')) return 'document-text-outline';
  return 'attach-outline';
}

const T = {
  en: {
    merge: 'Merge with...', mergeTitle: 'Merge Borrower', mergeDesc: 'All loans will move to the selected borrower. This cannot be undone.', mergeDone: 'Borrowers merged', mergeConfirm: 'Merge', searchBorrower: 'Search...', suggested: 'SUGGESTED', others: 'OTHERS',
    edit: 'Edit', save: 'Save', cancel: 'Cancel',
    newLoan: 'New Loan',
    activeLoans: 'Active', overdueLoans: 'Overdue', paidLoans: 'Paid',
    noLoans: 'No loans yet', noLoansHint: 'Create a loan for this borrower',
    outstanding: 'Outstanding', totalLoans: 'Loans', activeCount: 'Active',
    status: { active: 'Active', overdue: 'Overdue', paid: 'Paid', written_off: 'Written Off' },
    writtenOffLoans: 'Written Off',
    saved: 'Borrower updated',
    deleteBorrower: 'Delete Borrower',
    confirmDelete: 'Delete this borrower and ALL their loans? This cannot be undone.',
    confirmDeleteYes: 'Delete', deleted: 'Borrower deleted',
    interestOnly: 'I/O', principalInterest: 'P+I', accruing: 'Accruing',
    basis: { flat: 'Flat', reducing: 'Reducing' },
    name: 'Name', phone: 'Phone', address: 'Address',
    addedBy: 'Added by', editedBy: 'Edited by',
    tapToChange: 'Tap to change photo',
    socialSection: 'Social Links',
    // Tabs
    tabLoans: 'Loans', tabPayments: 'Payments', tabFiles: 'Files',
    // Payments
    noPayments: 'No payments yet',
    noPaymentsHint: 'Payments will appear here once recorded',
    principal: 'Principal', interest: 'Interest', total: 'Total',
    // Files
    noFiles: 'No files attached', noFilesHint: 'Upload contracts, photos or videos',
    uploadFile: 'Upload File', camera: 'Camera', photoLibrary: 'Photo Library',
    document: 'Document',
    deleteFile: 'Delete File',
    confirmDeleteFile: 'Delete this file?',
    uploaded: 'File uploaded', uploadFailed: 'Upload failed',
    fileDeleted: 'File deleted',
  },
  km: {
    merge: 'បញ្ចូលជាមួយ...', mergeTitle: 'បញ្ចូលអតិថិជន', mergeDesc: 'ប្រាក់កម្ចីទាំងអស់នឹងផ្លាស់ទៅអតិថិជនដែលបានជ្រើស។ មិនអាចមិនធ្វើវិញ។', mergeDone: 'បានបញ្ចូល', mergeConfirm: 'បញ្ចូល', searchBorrower: 'ស្វែងរក...', suggested: 'ស្រដៀងគ្នា', others: 'ផ្សេងៗ',
    edit: 'កែប្រែ', save: 'រក្សាទុក', cancel: 'បោះបង់',
    newLoan: 'ប្រាក់កម្ចីថ្មី',
    activeLoans: 'ដំណើរការ', overdueLoans: 'ហួសកំណត់', paidLoans: 'បានបង់',
    noLoans: 'មិនទាន់មានប្រាក់កម្ចី', noLoansHint: 'បង្កើតប្រាក់កម្ចីសម្រាប់អតិថិជននេះ',
    outstanding: 'កម្ចីដែលបានផ្តល់', totalLoans: 'កម្ចី', activeCount: 'ដំណើរការ',
    status: { active: 'ដំណើរការ', overdue: 'ហួសកំណត់', paid: 'បានបង់', written_off: 'បោះបង់' },
    writtenOffLoans: 'បោះបង់',
    saved: 'បានកែប្រែ',
    deleteBorrower: 'លុបអតិថិជន',
    confirmDelete: 'លុបអតិថិជននេះ និងប្រាក់កម្ចីទាំងអស់? មិនអាចមិនធ្វើវិញបានទេ។',
    confirmDeleteYes: 'លុប', deleted: 'បានលុបអតិថិជន',
    interestOnly: 'ការប្រាក់', principalInterest: 'ដើម+ការប្រាក់', accruing: 'បង្ហូរ',
    basis: { flat: 'ការប្រាក់ថេរ', reducing: 'ការប្រាក់ថយចុះ' },
    name: 'ឈ្មោះ', phone: 'ទូរសព្ទ', address: 'អាសយដ្ឋាន',
    addedBy: 'បន្ថែមដោយ', editedBy: 'កែដោយ',
    tapToChange: 'ចុចផ្លាស់ប្ដូររូបភាព',
    socialSection: 'ទំនាក់ទំនងបន្ថែម',
    tabLoans: 'កម្ចី', tabPayments: 'ការទូទាត់', tabFiles: 'ឯកសារ',
    noPayments: 'មិនទាន់មានការទូទាត់', noPaymentsHint: 'ការទូទាត់នឹងបង្ហាញនៅទីនេះ',
    principal: 'ប្រាក់ដើម', interest: 'ការប្រាក់', total: 'សរុប',
    noFiles: 'មិនមានឯកសារ', noFilesHint: 'បង្ហោះកិច្ចសន្យា រូបភាព ឬវីដេអូ',
    uploadFile: 'បង្ហោះឯកសារ', camera: 'កាមេរ៉ា', photoLibrary: 'រូបភាព',
    document: 'ឯកសារ',
    deleteFile: 'លុបឯកសារ',
    confirmDeleteFile: 'លុបឯកសារនេះ?',
    uploaded: 'បានបង្ហោះ', uploadFailed: 'បង្ហោះបានបរាជ័យ',
    fileDeleted: 'បានលុបឯកសារ',
  },
};

const BorrowerDetailScreen = ({ navigation, route }) => {
  const { borrowerId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language, fs, ff, fi } = useLanguage();
  const t = T[language] || T.en;
  const styles = useMemo(() => makeStyles(fs, ff, isDark, language), [fs, ff, isDark, language]);

  // Core data
  const [borrower, setBorrower] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(true);

  // Edit modal
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState(null);
  const [editFacebook, setEditFacebook] = useState('');
  const [editTelegram, setEditTelegram] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [saving, setSaving] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('loans');

  // Payments tab
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const loansRef = useRef(loans);
  loansRef.current = loans;

  // Files tab
  const [files, setFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);

  // Merge modal
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [merging, setMerging] = useState(false);

  // ── Listeners ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = listenBorrowers(all => {
      const found = all.find(b => b.id === borrowerId);
      if (found) {
        setBorrower(found);
        setEditName(found.name);
        setEditPhone(found.phone ?? '');
        setEditAddress(found.address ?? '');
        setEditFacebook(found.socialLinks?.facebook ?? '');
        setEditTelegram(found.socialLinks?.telegram ?? '');
        setEditWhatsapp(found.socialLinks?.whatsapp ?? '');
        setEditInstagram(found.socialLinks?.instagram ?? '');
      }
    });
    return unsub;
  }, [borrowerId]);

  useEffect(() => {
    const unsub = listenLoansByBorrower(borrowerId, data => {
      setLoans(data);
      setLoadingLoans(false);
    });
    return unsub;
  }, [borrowerId]);

  useEffect(() => {
    return listenBorrowerFiles(borrowerId, setFiles);
  }, [borrowerId]);

  // Load payments when tab activates (or when loans list changes)
  useEffect(() => {
    if (activeTab !== 'payments') return;
    const current = loansRef.current;
    if (current.length === 0) { setPayments([]); return; }
    setLoadingPayments(true);
    getBorrowerPayments(current)
      .then(p => { setPayments(p); setLoadingPayments(false); })
      .catch(() => setLoadingPayments(false));
  }, [activeTab, loans]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const fields = {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        socialLinks: {
          facebook: editFacebook.trim(),
          telegram: editTelegram.trim(),
          whatsapp: editWhatsapp.trim(),
          instagram: editInstagram.trim(),
        },
      };
      if (editPhotoUri) {
        const url = await uploadProfilePhoto(borrowerId, editPhotoUri);
        fields.photoURL = url;
        setEditPhotoUri(null);
      }
      await updateBorrower(borrowerId, fields);
      Toast.show({ text: t.saved, type: 'success' });
      setEditing(false);
    } catch (err) {
      Toast.show({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const pickEditPhoto = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Toast.show({ text: 'Photo library permission denied', type: 'error' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setEditPhotoUri(result.assets[0].uri);
  };

  const openSocialLink = (platform, value) => {
    if (!value.trim()) return;
    let url = value.trim();
    if (!url.startsWith('http')) {
      if (platform === 'facebook') url = `https://facebook.com/${url}`;
      else if (platform === 'telegram') url = `https://t.me/${url.replace('@', '')}`;
      else if (platform === 'whatsapp') url = `https://wa.me/${url.replace(/[^0-9]/g, '')}`;
      else if (platform === 'instagram') url = `https://instagram.com/${url.replace('@', '')}`;
    }
    Linking.openURL(url).catch(() => Toast.show({ text: 'Cannot open link', type: 'error' }));
  };

  const handleDeleteBorrower = () => {
    Alert.alert(t.deleteBorrower, t.confirmDelete, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirmDeleteYes, style: 'destructive',
        onPress: async () => {
          try {
            const borrowerLoans = await getLoansByBorrower(borrowerId);
            for (const loan of borrowerLoans) await deleteLoan(loan.id);
            await deleteBorrower(borrowerId);
            Toast.show({ text: t.deleted, type: 'success' });
            navigation.goBack();
          } catch (err) {
            Toast.show({ text: err.message, type: 'error' });
          }
        },
      },
    ]);
  };

  const handleOpenMerge = async () => {
    const all = await getBorrowers();
    const currentName = borrower?.name ?? '';
    const candidates = all
      .filter(b => b.id !== borrowerId)
      .map(b => ({ ...b, _similar: isSimilarName(currentName, b.name) }))
      .sort((a, b) => {
        if (a._similar && !b._similar) return -1;
        if (!a._similar && b._similar) return 1;
        return a.name.localeCompare(b.name);
      });
    setMergeCandidates(candidates);
    setMergeSearch('');
    setShowMergeModal(true);
  };

  const handleMerge = (target) => {
    Alert.alert(t.mergeTitle, t.mergeDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.mergeConfirm, style: 'destructive',
        onPress: async () => {
          setMerging(true);
          try {
            await mergeBorrowers(borrowerId, target.id, target.name);
            Toast.show({ text: t.mergeDone, type: 'success' });
            setShowMergeModal(false);
            navigation.goBack();
          } catch (err) {
            Toast.show({ text: err.message, type: 'error' });
          } finally {
            setMerging(false);
          }
        },
      },
    ]);
  };

  // ── File upload ────────────────────────────────────────────────────────────

  const doUpload = async (uri, fileName, mimeType) => {
    setUploadingFile(true);
    try {
      await uploadBorrowerFile(borrowerId, uri, fileName, mimeType);
      Toast.show({ text: t.uploaded, type: 'success' });
    } catch (err) {
      Toast.show({ text: err.message || t.uploadFailed, type: 'error' });
    } finally {
      setUploadingFile(false);
    }
  };

  const pickFromCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Toast.show({ text: 'Camera permission denied', type: 'error' }); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!result.canceled) {
      const asset = result.assets[0];
      const ext = asset.type === 'video' ? 'mp4' : 'jpg';
      const name = asset.fileName || `capture_${Date.now()}.${ext}`;
      const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      await doUpload(asset.uri, name, mime);
    }
  };

  const pickFromLibrary = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Toast.show({ text: 'Photo library permission denied', type: 'error' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        const ext = asset.type === 'video' ? 'mp4' : 'jpg';
        const name = asset.fileName || `photo_${Date.now()}.${ext}`;
        const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
        await doUpload(asset.uri, name, mime);
      }
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
    if (!result.canceled) {
      for (const file of result.assets) {
        await doUpload(file.uri, file.name, file.mimeType || 'application/octet-stream');
      }
    }
  };

  const handleUploadPress = () => {
    Alert.alert(t.uploadFile, undefined, [
      { text: t.camera, onPress: pickFromCamera },
      { text: t.photoLibrary, onPress: pickFromLibrary },
      { text: t.document, onPress: pickDocument },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const handleDeleteFile = (file) => {
    Alert.alert(t.deleteFile, `${t.confirmDeleteFile}\n"${file.name}"`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirmDeleteYes, style: 'destructive',
        onPress: async () => {
          try {
            await deleteBorrowerFile(borrowerId, file.id, file.storagePath);
            Toast.show({ text: t.fileDeleted, type: 'success' });
          } catch (err) {
            Toast.show({ text: err.message, type: 'error' });
          }
        },
      },
    ]);
  };

  const handleFilePress = (file) => {
    if (isImage(file.mimeType)) {
      setViewingImage(file.url);
    } else {
      Linking.openURL(file.url);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const groupedLoans = useMemo(() => ({
    overdue:    loans.filter(l => l.status === 'overdue'),
    active:     loans.filter(l => l.status === 'active'),
    paid:       loans.filter(l => l.status === 'paid'),
    writtenOff: loans.filter(l => l.status === 'written_off'),
  }), [loans]);

  const loanStats = useMemo(() => {
    const activeLoans = loans.filter(l => l.status !== 'paid' && l.status !== 'written_off');
    const outstanding = activeLoans.reduce((s, l) => s + (l.currentPrincipal ?? 0), 0);
    const currency = loans[0]?.currency ?? 'USD';
    return { outstanding, total: loans.length, active: activeLoans.length, currency };
  }, [loans]);

  const inputBg = isDark ? colors.surface : '#F2F4F8';
  const aColor = borrower ? avatarColor(borrower.name) : ACCENT;

  // ── Sub-renders ───────────────────────────────────────────────────────────

  const renderLoanCard = (loan) => {
    const statusColor = STATUS_COLORS[loan.status] ?? STATUS_COLORS.active;
    const accrued = loan.scheduleMode === 'open' && loan.status !== 'paid' && loan.status !== 'written_off'
      ? calcAccruedInterest(loan) : null;
    return (
      <TouchableOpacity
        key={loan.id}
        onPress={() => navigation.navigate('Tabs', { screen: 'LoansTab', params: { screen: 'LoanDetail', params: { loanId: loan.id } } })}
        activeOpacity={0.8}
        style={{ marginBottom: 8 }}
      >
        <GlassCard>
          <View style={styles.loanRow}>
            <View style={[styles.loanDot, { backgroundColor: statusColor + '25' }]}>
              <View style={[styles.loanDotInner, { backgroundColor: statusColor }]} />
            </View>
            <View style={styles.loanInfo}>
              <View style={styles.loanTopRow}>
                <Text style={[styles.loanPrincipal, { color: colors.text }]}>
                  {formatCurrency(loan.currentPrincipal, loan.currency)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {t.status[loan.status] ?? loan.status}
                  </Text>
                </View>
              </View>
              <Text style={[styles.loanMeta, { color: colors.textMuted }]}>
                {loan.startDate} · {loan.interestRate}% · {t.basis[loan.interestBasis] ?? loan.interestBasis} · {loan.repaymentType === 'interest_only' ? t.interestOnly : t.principalInterest}
              </Text>
              {accrued !== null && accrued > 0 && (
                <Text style={styles.accruingText}>{t.accruing}: {formatCurrency(accrued, loan.currency)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const renderPaymentRow = (payment, index) => {
    const currency = payment.loanCurrency ?? 'USD';
    return (
      <GlassCard key={payment.id ?? index} style={{ marginBottom: 8 }}>
        <View style={styles.payRow}>
          {/* Date badge */}
          <View style={[styles.payDateBadge, { backgroundColor: ACCENT + '15' }]}>
            <Ionicons name="calendar-outline" size={14} color={ACCENT} />
            <Text style={[styles.payDateText, { color: ACCENT }, ff('400')]}>{payment.date}</Text>
          </View>

          {/* Breakdown */}
          <View style={styles.payBreakdown}>
            {payment.principalAmount > 0 && (
              <View style={styles.payLine}>
                <Text style={[styles.payLabel, { color: colors.textMuted }, ff('400')]}>{t.principal}</Text>
                <Text style={[styles.payValue, { color: colors.text }, ff('400')]}>{formatCurrency(payment.principalAmount, currency)}</Text>
              </View>
            )}
            {payment.interestAmount > 0 && (
              <View style={styles.payLine}>
                <Text style={[styles.payLabel, { color: colors.textMuted }, ff('400')]}>{t.interest}</Text>
                <Text style={[styles.payValue, { color: '#F59E0B' }, ff('400')]}>{formatCurrency(payment.interestAmount, currency)}</Text>
              </View>
            )}
          </View>

          {/* Total */}
          <Text style={[styles.payTotal, { color: '#10B981' }, ff('400')]}>{formatCurrency(payment.totalAmount, currency)}</Text>
        </View>
        {payment.notes ? (
          <Text style={[styles.payNotes, { color: colors.textMuted, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }, ff('400')]}>
            {payment.notes}
          </Text>
        ) : null}
      </GlassCard>
    );
  };

  const renderFileItem = (file) => {
    const isImg = isImage(file.mimeType);
    const isVid = isVideo(file.mimeType);
    const showThumb = isImg || isVid;
    const imgSize = (SCREEN_W - 32 - 12) / 2; // 2 col grid

    if (showThumb) {
      return (
        <TouchableOpacity
          key={file.id}
          style={[styles.fileThumbnailWrap, { width: imgSize, backgroundColor: isDark ? colors.surface : '#E5E7EB' }]}
          onPress={() => handleFilePress(file)}
          onLongPress={() => handleDeleteFile(file)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: file.url }} style={[styles.fileThumbnail, { width: imgSize, height: imgSize }]} resizeMode="cover" />
          {isVid && (
            <View style={styles.fileVideoOverlay}>
              <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
            </View>
          )}
          <View style={[styles.fileNameBar, { backgroundColor: 'rgba(0,0,0,0.48)' }]}>
            <Text style={styles.fileNameBarText} numberOfLines={1}>{file.name}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Document row
    return (
      <TouchableOpacity
        key={file.id}
        onPress={() => handleFilePress(file)}
        onLongPress={() => handleDeleteFile(file)}
        activeOpacity={0.8}
        style={{ marginBottom: 8 }}
      >
        <GlassCard>
          <View style={styles.fileDocRow}>
            <View style={[styles.fileDocIcon, { backgroundColor: ACCENT + '18' }]}>
              <Ionicons name={fileIcon(file.mimeType)} size={22} color={ACCENT} />
            </View>
            <View style={styles.fileDocInfo}>
              <Text style={[styles.fileDocName, { color: colors.text }, ff('400')]} numberOfLines={2}>{file.name}</Text>
              {file.size ? <Text style={[styles.fileDocSize, { color: colors.textMuted }, ff('400')]}>{formatBytes(file.size)}</Text> : null}
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  // ── Tab content ───────────────────────────────────────────────────────────

  const renderLoansTab = () => (
    <>
      {/* New Loan button */}
      <TouchableOpacity
        style={styles.newLoanBtn}
        onPress={() => navigation.navigate('CreateLoan', { prefillBorrowerId: borrower.id, prefillBorrowerName: borrower.name })}
        activeOpacity={0.82}
      >
        <View style={styles.newLoanInner}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={[styles.newLoanBtnText, { fontSize: fs(15) }]}>{t.newLoan}</Text>
        </View>
      </TouchableOpacity>

      {loadingLoans ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
      ) : loans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: ACCENT + '15' }]}>
            <Ionicons name="document-text-outline" size={32} color={ACCENT} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text, fontSize: fs(16) }]}>{t.noLoans}</Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted, fontSize: fs(13) }]}>{t.noLoansHint}</Text>
        </View>
      ) : (
        <>
          {groupedLoans.overdue.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#EF4444', fontSize: fs(12) }]}>{t.overdueLoans.toUpperCase()}</Text>
                <View style={[styles.sectionBadge, { backgroundColor: '#EF444420' }]}>
                  <Text style={[styles.sectionBadgeText, { color: '#EF4444', fontSize: fs(11) }]}>{groupedLoans.overdue.length}</Text>
                </View>
              </View>
              {groupedLoans.overdue.map(renderLoanCard)}
            </>
          )}
          {groupedLoans.active.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#10B981', fontSize: fs(12) }]}>{t.activeLoans.toUpperCase()}</Text>
                <View style={[styles.sectionBadge, { backgroundColor: '#10B98120' }]}>
                  <Text style={[styles.sectionBadgeText, { color: '#10B981', fontSize: fs(11) }]}>{groupedLoans.active.length}</Text>
                </View>
              </View>
              {groupedLoans.active.map(renderLoanCard)}
            </>
          )}
          {groupedLoans.paid.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: fs(12) }]}>{t.paidLoans.toUpperCase()}</Text>
                <View style={[styles.sectionBadge, { backgroundColor: colors.textMuted + '20' }]}>
                  <Text style={[styles.sectionBadgeText, { color: colors.textMuted, fontSize: fs(11) }]}>{groupedLoans.paid.length}</Text>
                </View>
              </View>
              {groupedLoans.paid.map(renderLoanCard)}
            </>
          )}
          {groupedLoans.writtenOff.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#6B7280', fontSize: fs(12) }]}>{t.writtenOffLoans.toUpperCase()}</Text>
                <View style={[styles.sectionBadge, { backgroundColor: '#6B728020' }]}>
                  <Text style={[styles.sectionBadgeText, { color: '#6B7280', fontSize: fs(11) }]}>{groupedLoans.writtenOff.length}</Text>
                </View>
              </View>
              {groupedLoans.writtenOff.map(renderLoanCard)}
            </>
          )}
        </>
      )}
    </>
  );

  const renderPaymentsTab = () => (
    <>
      {loadingPayments ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
      ) : payments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="receipt-outline" size={32} color="#10B981" />
          </View>
          <Text style={[styles.emptyText, { color: colors.text, fontSize: fs(16) }]}>{t.noPayments}</Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted, fontSize: fs(13) }]}>{t.noPaymentsHint}</Text>
        </View>
      ) : (
        payments.map(renderPaymentRow)
      )}
    </>
  );

  const renderFilesTab = () => {
    const imageFiles = files.filter(f => isImage(f.mimeType) || isVideo(f.mimeType));
    const docFiles = files.filter(f => !isImage(f.mimeType) && !isVideo(f.mimeType));

    return (
      <>
        {/* Upload button */}
        <TouchableOpacity
          style={[styles.uploadBtn, { shadowColor: '#000' }]}
          onPress={handleUploadPress}
          disabled={uploadingFile}
          activeOpacity={0.82}
        >
          <View style={styles.uploadBtnInner}>
            {uploadingFile
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            }
            <Text style={[styles.uploadBtnText, { fontSize: fs(15) }]}>{t.uploadFile}</Text>
          </View>
        </TouchableOpacity>

        {files.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: '#00C2B215' }]}>
              <Ionicons name="folder-outline" size={32} color={ACCENT} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text, fontSize: fs(16) }]}>{t.noFiles}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted, fontSize: fs(13) }]}>{t.noFilesHint}</Text>
          </View>
        ) : (
          <>
            {/* Image / video grid */}
            {imageFiles.length > 0 && (
              <View style={styles.fileGrid}>
                {imageFiles.map(renderFileItem)}
              </View>
            )}
            {/* Document list */}
            {docFiles.map(renderFileItem)}
            <Text style={[styles.longPressHint, { color: colors.textMuted }, ff('400')]}>
              Long press a file to delete
            </Text>
          </>
        )}
      </>
    );
  };

  // ── Counts for tab badges ─────────────────────────────────────────────────

  const tabCounts = { loans: loans.length, payments: payments.length, files: files.length };

  if (!borrower) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB', alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : '#EBEBEB' }]}>
      <SafeAreaView edges={['top']}>
        {/* Header nav */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => { setEditing(true); setEditPhotoUri(null); }}
            style={[styles.editBtn, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={15} color={colors.text} />
            <Text style={[styles.editBtnText, { color: colors.text }]}>{t.edit}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>

        {/* Hero card */}
        <GlassCard style={{ marginBottom: 16 }}>
          <View style={styles.heroCard}>
            {borrower.photoURL ? (
              <View style={[styles.heroAvatar, { overflow: 'hidden' }]}>
                <Image source={{ uri: borrower.photoURL }} style={styles.heroAvatarImg} />
              </View>
            ) : (
              <View style={[styles.heroAvatar, { backgroundColor: aColor + '20', borderColor: aColor + '40', borderWidth: 2 }]}>
                <Text style={[styles.heroAvatarText, { color: aColor }]}>
                  {borrower.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.heroName, { color: colors.text }]}>{borrower.name}</Text>
            {borrower.phone ? (
              <View style={styles.heroMetaRow}>
                <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.heroMeta, { color: colors.textMuted }]}>{borrower.phone}</Text>
              </View>
            ) : null}
            {borrower.address ? (
              <View style={styles.heroMetaRow}>
                <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.heroMeta, { color: colors.textMuted }]}>{borrower.address}</Text>
              </View>
            ) : null}
            {SOCIAL_META.some(s => borrower.socialLinks?.[s.key]) && (
              <View style={styles.heroSocialRow}>
                {SOCIAL_META.map(({ key, icon, color }) => {
                  const val = borrower.socialLinks?.[key];
                  if (!val) return null;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.heroSocialBtn, { backgroundColor: color + '18' }]}
                      onPress={() => openSocialLink(key, val)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={icon} size={20} color={color} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={[styles.heroDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: loanStats.outstanding > 0 ? '#F59E0B' : colors.textMuted }]}
                  numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {loanStats.outstanding > 0 ? formatCurrency(loanStats.outstanding, loanStats.currency) : '—'}
                </Text>
                <Text style={[styles.heroStatLabel, { color: colors.textMuted }]}>{t.outstanding}</Text>
              </View>
              <View style={[styles.heroStatDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: loanStats.active > 0 ? ACCENT : colors.textMuted }]}>
                  {loanStats.active}
                </Text>
                <Text style={[styles.heroStatLabel, { color: colors.textMuted }]}>{t.activeCount}</Text>
              </View>
              <View style={[styles.heroStatDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: colors.text }]}>{loanStats.total}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textMuted }]}>{t.totalLoans}</Text>
              </View>
            </View>
            {(borrower.createdByName || borrower.updatedByName) && (
              <View style={[styles.auditRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
                {borrower.createdByName ? (
                  <Text style={[styles.auditText, { color: colors.textMuted }]}>{t.addedBy}: {borrower.createdByName}</Text>
                ) : null}
                {borrower.updatedByName ? (
                  <Text style={[styles.auditText, { color: colors.textMuted }]}>{t.editedBy}: {borrower.updatedByName}</Text>
                ) : null}
              </View>
            )}
          </View>
        </GlassCard>

        {/* ── 3-Tab Bar ── */}
        <View style={[styles.tabBar, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
          {[
            { key: 'loans',    label: t.tabLoans,    icon: 'document-text-outline' },
            { key: 'payments', label: t.tabPayments,  icon: 'receipt-outline' },
            { key: 'files',    label: t.tabFiles,     icon: 'folder-outline' },
          ].map(tab => {
            const active = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, active && styles.tabItemActive, active && { borderBottomColor: ACCENT }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={active ? tab.icon.replace('-outline', '') : tab.icon} size={17} color={active ? ACCENT : colors.textMuted} />
                <Text style={[styles.tabLabel, { color: active ? ACCENT : colors.textMuted }, ff(active ? '600' : '400')]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: active ? ACCENT : colors.textMuted + '30' }]}>
                    <Text style={[styles.tabBadgeText, { color: active ? '#fff' : colors.textMuted }, ff('400')]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab content */}
        <View style={{ marginTop: 12 }}>
          {activeTab === 'loans'    && renderLoansTab()}
          {activeTab === 'payments' && renderPaymentsTab()}
          {activeTab === 'files'    && renderFilesTab()}
        </View>

        {/* Merge borrower */}
        <TouchableOpacity
          style={[styles.mergeBtn, { borderColor: '#F59E0B28', backgroundColor: isDark ? '#F59E0B10' : '#FFFBEB' }]}
          onPress={handleOpenMerge}
          activeOpacity={0.7}
        >
          <Ionicons name="git-merge-outline" size={18} color="#F59E0B" />
          <Text style={[styles.mergeBtnText]}>{t.merge}</Text>
        </TouchableOpacity>

        {/* Delete borrower */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: '#EF444428', backgroundColor: isDark ? '#EF444410' : '#FFF0F0' }]}
          onPress={handleDeleteBorrower}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={17} color="#EF4444" />
          <Text style={[styles.deleteBtnText, { fontSize: fs(14) }]}>{t.deleteBorrower}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editing} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? colors.surface : '#fff' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.modalCancelBtn}>
                <Text style={[styles.modalCancel, { color: colors.textMuted, fontSize: fs(15) }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: fs(16) }]}>{t.edit}</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving} style={styles.modalSaveBtn}>
                {saving
                  ? <ActivityIndicator color={ACCENT} size="small" />
                  : <Text style={[styles.modalSave, { color: ACCENT, fontSize: fs(15) }]}>{t.save}</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12 }}>
              {/* Profile photo picker */}
              <View style={{ alignItems: 'center', marginBottom: 4 }}>
                <TouchableOpacity onPress={pickEditPhoto} style={styles.editPhotoBtn} activeOpacity={0.8}>
                  {editPhotoUri ? (
                    <View style={[styles.editPhotoCircle, { overflow: 'hidden' }]}>
                      <Image source={{ uri: editPhotoUri }} style={{ width: 80, height: 80 }} />
                    </View>
                  ) : borrower.photoURL ? (
                    <View style={[styles.editPhotoCircle, { overflow: 'hidden' }]}>
                      <Image source={{ uri: borrower.photoURL }} style={{ width: 80, height: 80 }} />
                    </View>
                  ) : (
                    <View style={[styles.editPhotoCircle, { backgroundColor: aColor + '20', borderWidth: 2, borderColor: aColor + '40', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: fs(26), lineHeight: 52, letterSpacing: 0, color: aColor, ...ff('600') }}>{borrower?.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[styles.editPhotoCam, { backgroundColor: ACCENT }]}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={[{ fontSize: fs(12), lineHeight: 29, letterSpacing: 0, color: colors.textMuted, marginTop: 6, ...ff('400') }]}>{t.tapToChange}</Text>
              </View>

              {/* Name / Phone / Address */}
              {[
                { value: editName,    setter: setEditName,    placeholder: t.name,    capitalize: 'words',     keyboard: 'default' },
                { value: editPhone,   setter: setEditPhone,   placeholder: t.phone,   capitalize: 'none',      keyboard: 'phone-pad' },
                { value: editAddress, setter: setEditAddress, placeholder: t.address, capitalize: 'sentences', keyboard: 'default' },
              ].map(({ value, setter, placeholder, capitalize, keyboard }, i) => (
                <View key={i} style={[styles.inputWrap, { backgroundColor: inputBg }]}>
                  <TextInput
                    style={[styles.editInput, { color: colors.text, fontSize: fs(15) }, fi()]}
                    value={value}
                    onChangeText={setter}
                    autoCapitalize={capitalize}
                    keyboardType={keyboard}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}

              {/* Social Links */}
              <Text style={[{ fontSize: fs(11), lineHeight: 27, letterSpacing: 0, ...ff('600'), color: colors.textMuted }]}>
                {t.socialSection.toUpperCase()}
              </Text>
              {[
                { key: 'facebook',  icon: 'logo-facebook',      color: '#1877F2', value: editFacebook,  setter: setEditFacebook,  ph: 'Facebook username' },
                { key: 'telegram',  icon: 'paper-plane-outline', color: '#2AABEE', value: editTelegram,  setter: setEditTelegram,  ph: 'Telegram @username' },
                { key: 'whatsapp',  icon: 'logo-whatsapp',       color: '#25D366', value: editWhatsapp,  setter: setEditWhatsapp,  ph: 'WhatsApp +855...' },
                { key: 'instagram', icon: 'logo-instagram',      color: '#E1306C', value: editInstagram, setter: setEditInstagram, ph: 'Instagram @username' },
              ].map(({ key, icon, color, value, setter, ph }) => (
                <View key={key} style={[styles.socialInputRow, { backgroundColor: inputBg }]}>
                  <View style={[styles.socialInputIcon, { backgroundColor: color + '18' }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <TextInput
                    style={[styles.socialInputField, { color: colors.text, fontSize: fs(15) }, fi()]}
                    value={value}
                    onChangeText={setter}
                    placeholder={ph}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen image viewer */}
      <Modal visible={!!viewingImage} transparent animationType="fade">
        <TouchableOpacity
          style={styles.imgViewer}
          activeOpacity={1}
          onPress={() => setViewingImage(null)}
        >
          {viewingImage && (
            <Image source={{ uri: viewingImage }} style={styles.imgViewerImg} resizeMode="contain" />
          )}
          <View style={styles.imgViewerClose}>
            <Ionicons name="close-circle" size={34} color="rgba(255,255,255,0.85)" />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Merge modal */}
      <Modal visible={showMergeModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMergeModal(false)} />
          <View style={[styles.mergeSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.pickerHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            <Text style={[styles.mergeSheetTitle, { color: colors.text }]}>{t.mergeTitle}</Text>
            <View style={[styles.mergeSearchWrap, { backgroundColor: isDark ? colors.background : '#F2F4F8', borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={15} color={colors.textMuted} />
              <TextInput
                style={[styles.mergeSearchInput, { color: colors.text }, fi()]}
                value={mergeSearch}
                onChangeText={setMergeSearch}
                placeholder={t.searchBorrower}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {(() => {
                const filtered = mergeCandidates.filter(b => !mergeSearch || b.name.toLowerCase().includes(mergeSearch.toLowerCase()));
                const similar = filtered.filter(b => b._similar);
                const rest = filtered.filter(b => !b._similar);
                const renderRow = (b, i, arr) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.mergeRow, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                    onPress={() => handleMerge(b)}
                    activeOpacity={0.7}
                    disabled={merging}
                  >
                    <View style={[styles.mergeAvatar, { backgroundColor: ACCENT + '20' }]}>
                      <Text style={[styles.mergeAvatarText, { color: ACCENT }, ff('600')]}>{b.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mergeName, { color: colors.text }, ff('400')]}>{b.name}</Text>
                      {b.phone ? <Text style={[styles.mergePhone, { color: colors.textMuted }, ff('400')]}>{b.phone}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                );
                return (
                  <>
                    {similar.length > 0 && (
                      <>
                        <Text style={[styles.mergeSectionHeader, { color: ACCENT }]}>{t.suggested}</Text>
                        {similar.map((b, i) => renderRow(b, i, similar))}
                      </>
                    )}
                    {rest.length > 0 && (
                      <>
                        {similar.length > 0 && <Text style={[styles.mergeSectionHeader, { color: colors.textMuted }]}>{t.others}</Text>}
                        {rest.map((b, i) => renderRow(b, i, rest))}
                      </>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = (fs, ff, isDark = false, language) => {
  const km = true;
  return StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  editBtnText: { fontSize: fs(13), lineHeight: km ? 31 : 24, ...ff('600') },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  /* Hero */
  heroCard: { alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20 },
  heroAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroAvatarImg: { width: 80, height: 80 },
  heroAvatarText: { fontSize: fs(32), lineHeight: km ? 60 : 46, ...ff('600'), textAlign: 'center' },
  heroName: { fontSize: fs(22), ...ff('600'), marginBottom: 8, textAlign: 'center' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  heroMeta: { fontSize: fs(13), lineHeight: km ? 31 : 24, ...ff('400') },
  heroSocialRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 4 },
  heroSocialBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroDivider: { height: 1, alignSelf: 'stretch', marginVertical: 16 },
  heroStats: { flexDirection: 'row', alignSelf: 'stretch', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  heroStatDivider: { width: 1, height: 36, alignSelf: 'center' },
  heroStatValue: { fontSize: fs(17), lineHeight: km ? 36 : 28, ...ff('400') },
  heroStatLabel: { fontSize: fs(11), lineHeight: km ? 27 : 21, ...ff('600') },
  auditRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, alignSelf: 'stretch', gap: 3 },
  auditText: { fontSize: fs(11), lineHeight: km ? 27 : 21, ...ff('400'), textAlign: 'center' },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 4,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: {},
  tabLabel: { fontSize: fs(12.5), lineHeight: km ? 30 : 23 },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: fs(10.5), lineHeight: km ? 18 : 14, includeFontPadding: false },

  /* New Loan button */
  newLoanBtn: {
    borderRadius: 14, backgroundColor: ACCENT, marginBottom: 16,
  },
  newLoanInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
  newLoanBtnText: { color: '#fff', lineHeight: km ? 26 : 20, ...ff('600') },

  /* Upload button */
  uploadBtn: {
    borderRadius: 14, backgroundColor: '#00C2B2', marginBottom: 16,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  uploadBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
  uploadBtnText: { color: '#fff', lineHeight: km ? 26 : 20, ...ff('600') },

  /* Section headers */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  sectionTitle: { ...ff('600'), lineHeight: km ? 29 : 22, letterSpacing: 0 },
  sectionBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionBadgeText: { ...ff('600'), lineHeight: km ? 27 : 21, textAlign: 'center' },

  /* Loan card */
  loanRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  loanDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  loanDotInner: { width: 11, height: 11, borderRadius: 6 },
  loanInfo: { flex: 1 },
  loanTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  loanPrincipal: { fontSize: fs(16), lineHeight: km ? 35 : 27, ...ff('400') },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: fs(11), lineHeight: km ? 27 : 21, ...ff('600') },
  loanMeta: { fontSize: fs(12), lineHeight: km ? 29 : 22, ...ff('400') },
  accruingText: { fontSize: fs(12), lineHeight: km ? 29 : 22, color: '#F59E0B', ...ff('600'), marginTop: 2 },

  /* Payment rows */
  payRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  payDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  payDateText: { fontSize: fs(11.5), lineHeight: km ? 27 : 21 },
  payBreakdown: { flex: 1, gap: 2 },
  payLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel: { fontSize: fs(11.5), lineHeight: km ? 27 : 21 },
  payValue: { fontSize: fs(13), lineHeight: km ? 30 : 23 },
  payTotal: { fontSize: fs(15), lineHeight: km ? 34 : 26 },
  payNotes: {
    fontSize: fs(12), lineHeight: km ? 29 : 22, paddingHorizontal: 14, paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: -4,
  },

  /* File grid */
  fileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  fileThumbnailWrap: { borderRadius: 14, overflow: 'hidden' },
  fileThumbnail: {},
  fileVideoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  fileNameBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 8, paddingVertical: 6 },
  fileNameBarText: { color: '#fff', fontSize: fs(11), lineHeight: km ? 26 : 20, ...ff('400') },

  /* Document row */
  fileDocRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  fileDocIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileDocInfo: { flex: 1 },
  fileDocName: { fontSize: fs(14), lineHeight: km ? 33 : 25 },
  fileDocSize: { fontSize: fs(11.5), lineHeight: km ? 27 : 21, marginTop: 2 },

  longPressHint: { fontSize: fs(11), lineHeight: km ? 27 : 21, textAlign: 'center', marginTop: 8, marginBottom: 4 },

  /* Empty */
  emptyWrap: { alignItems: 'center', gap: 10, paddingTop: 32, paddingBottom: 16 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText: { ...ff('600'), lineHeight: km ? 27 : 21 },
  emptyHint: { lineHeight: km ? 31 : 24, ...ff('400') },

  /* Delete */
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 15, borderRadius: 14, borderWidth: 1 },
  deleteBtnText: { ...ff('600'), lineHeight: km ? 33 : 25, color: '#EF4444' },

  /* Merge */
  mergeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 15, borderRadius: 14, borderWidth: 1 },
  mergeBtnText: { fontSize: fs(14), lineHeight: km ? 33 : 25, color: '#F59E0B', letterSpacing: 0, ...ff('600') },
  mergeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 24 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  mergeSheetTitle: { fontSize: fs(16), lineHeight: km ? 35 : 27, letterSpacing: 0, ...ff('700'), textAlign: 'center', marginBottom: 12 },
  mergeSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1 },
  mergeSearchInput: { flex: 1, fontSize: fs(14), letterSpacing: 0 },
  mergeSectionHeader: { fontSize: fs(11), lineHeight: km ? 27 : 21, letterSpacing: 0, ...ff('700'), paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  mergeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  mergeAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mergeAvatarText: { fontSize: fs(15), lineHeight: km ? 34 : 26, letterSpacing: 0 },
  mergeName: { fontSize: fs(14), lineHeight: km ? 33 : 25, letterSpacing: 0, marginBottom: 1 },
  mergePhone: { fontSize: fs(12), lineHeight: km ? 30 : 23, letterSpacing: 0 },

  /* Edit modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalCancelBtn: { minWidth: 60 },
  modalSaveBtn: { minWidth: 60, alignItems: 'flex-end' },
  modalCancel: { ...ff('400'), lineHeight: km ? 26 : 20 },
  modalTitle: { ...ff('600'), lineHeight: km ? 27 : 21 },
  modalSave: { ...ff('600'), lineHeight: km ? 26 : 20 },
  inputWrap: { borderRadius: 12, overflow: 'hidden' },
  editInput: { height: 50, paddingHorizontal: 14 },
  editPhotoBtn: { position: 'relative' },
  editPhotoCircle: { width: 80, height: 80, borderRadius: 40 },
  editPhotoCam: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  socialInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  socialInputIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  socialInputField: { flex: 1, height: 48, paddingHorizontal: 12, lineHeight: km ? 26 : 20, letterSpacing: 0, ...ff('400') },

  /* Image viewer */
  imgViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imgViewerImg: { width: SCREEN_W, height: SCREEN_W * 1.4 },
  imgViewerClose: { position: 'absolute', top: 56, right: 20 },
});
};

export default BorrowerDetailScreen;
