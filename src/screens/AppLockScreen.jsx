/**
 * APP LOCK SCREEN
 * Shown as a fullscreen overlay when the app is locked.
 * Auto-triggers biometric prompt on mount.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppLock } from '../context/AppLockContext';
import { useTheme } from '../theme/ThemeContext';

export default function AppLockScreen() {
  const { unlock } = useAppLock();
  const { colors, isDark } = useTheme();

  // Auto-trigger biometric prompt as soon as screen appears
  useEffect(() => {
    unlock();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0A0A' : '#F5F5F5' }]}>
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1A1A2E' : '#E8E8F8' }]}>
          <Ionicons name="lock-closed" size={48} color="#6366F1" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>App Locked</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Authenticate to continue
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={unlock}
          activeOpacity={0.8}
        >
          <Ionicons name="finger-print" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    alignItems: 'center',
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
