/**
 * SET PIN SCREEN
 * 4-digit PIN entry with confirmation step. Glass keypad design.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppLock } from '../../context/AppLockContext';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT  = '#6366F1';
const PIN_LEN = 4;
const KEYS    = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

const T = {
  en: {
    create:    'Create PIN',
    confirm:   'Confirm PIN',
    createSub: 'Enter a 4-digit PIN',
    confirmSub:'Enter your PIN again to confirm',
    noMatch:   "PINs don't match — try again",
    step:      'Step',
  },
  km: {
    create:    'បង្កើតលេខសម្ងាត់',
    confirm:   'បញ្ជាក់លេខសម្ងាត់',
    createSub: 'បញ្ចូលលេខសម្ងាត់ 4 ខ្ទង់',
    confirmSub:'បញ្ចូលម្តងទៀតដើម្បីបញ្ជាក់',
    noMatch:   'លេខសម្ងាត់មិនត្រូវគ្នា — សាកម្តងទៀត',
    step:      'ជំហាន',
  },
};

export default function SetPINScreen({ navigation }) {
  const { savePIN } = useAppLock();
  const { colors, isDark } = useTheme();
  const { language, fs, ff } = useLanguage();
  const t = T[language] || T.en;

  const [step,     setStep]     = useState('create');
  const [firstPIN, setFirstPIN] = useState('');
  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState(false);

  const styles = useMemo(() => makeStyles(ff), [ff]);

  const handleKey = useCallback(async (key) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (key === '')   return;
    const next = pin + key;
    if (next.length > PIN_LEN) return;
    setPin(next);

    if (next.length === PIN_LEN) {
      if (step === 'create') {
        setFirstPIN(next);
        setPin('');
        setStep('confirm');
      } else {
        if (next === firstPIN) {
          await savePIN(next);
          navigation.goBack();
        } else {
          setError(true);
          Vibration.vibrate(300);
          setTimeout(() => {
            setPin(''); setFirstPIN(''); setStep('create'); setError(false);
          }, 700);
        }
      }
    }
  }, [pin, step, firstPIN, savePIN, navigation]);

  const isConfirm = step === 'confirm';
  const title     = isConfirm ? t.confirm   : t.create;
  const subtitle  = error     ? t.noMatch   : isConfirm ? t.confirmSub : t.createSub;
  const keyBg     = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.72)';
  const keyBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
  const dotEmpty  = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.13)';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#080810' : '#F0F0F7' }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(20) }]}>{title}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {/* Step pills */}
        <View style={styles.steps}>
          {[0, 1].map(i => (
            <View
              key={i}
              style={[
                styles.stepPill,
                {
                  backgroundColor: i <= (isConfirm ? 1 : 0)
                    ? ACCENT
                    : (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'),
                  width: i <= (isConfirm ? 1 : 0) ? 24 : 16,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.subtitle, { color: error ? '#EF4444' : colors.textMuted, fontSize: fs(14) }]}>
          {subtitle}
        </Text>

        {/* PIN dots */}
        <View style={styles.dots}>
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < pin.length
                    ? (error ? '#EF4444' : ACCENT)
                    : dotEmpty,
                  transform: [{ scale: i < pin.length ? 1.15 : 1 }],
                },
              ]}
            />
          ))}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {KEYS.map((key, i) => (
            key === '' ? (
              <View key={i} style={styles.keySlot} />
            ) : (
              <TouchableOpacity
                key={i}
                style={styles.keySlot}
                onPress={() => handleKey(key)}
                activeOpacity={0.65}
              >
                <View style={[styles.keyBtn, { backgroundColor: keyBg, borderColor: keyBorder }]}>
                  {key === '⌫'
                    ? <Ionicons name="backspace-outline" size={22} color={colors.text} />
                    : <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                  }
                </View>
              </TouchableOpacity>
            )
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (ff) => StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, gap: 4 },
  backBtn:     { padding: 4 },
  headerTitle: { ...ff('700'), letterSpacing: 0 },

  body:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 56 },
  steps:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  stepPill:  { height: 6, borderRadius: 3 },
  subtitle:  { marginBottom: 36, textAlign: 'center', lineHeight: 22, paddingHorizontal: 32 },

  dots:    { flexDirection: 'row', gap: 18, marginBottom: 44 },
  dot:     { width: 13, height: 13, borderRadius: 6.5 },

  keypad:  { flexDirection: 'row', flexWrap: 'wrap', width: 288, justifyContent: 'center' },
  keySlot: { width: 96, height: 80, justifyContent: 'center', alignItems: 'center' },
  keyBtn:  {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { fontSize: 26, ...ff('400') },
});
