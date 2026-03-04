/**
 * THEME SYSTEM — Bacou Loan
 * Accent: #00C2B2 (indigo)
 */

import { Platform } from 'react-native';

export const lightColors = {
  primary: '#00C2B2',
  primaryDark: '#4f46e5',

  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',

  text: '#1F2937',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',

  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
};

export const darkColors = {
  primary: '#818cf8',
  primaryDark: '#00C2B2',

  danger: '#FF8A8A',
  warning: '#FFD97A',
  success: '#5EEAAD',

  text: '#FFFFFF',
  textLight: '#C5CBD8',
  textMuted: '#9AA3B8',

  background: '#000000',
  surface: '#111111',
  border: '#2A2A2A',
};

export const getColors = (isDark) => isDark ? darkColors : lightColors;

export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
};

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
};

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

export const shadows = {
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    android: { elevation: 4 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
    android: { elevation: 8 },
  }),
};

export default { colors, typography, spacing, borderRadius, shadows };
