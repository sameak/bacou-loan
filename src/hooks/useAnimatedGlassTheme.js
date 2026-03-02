/**
 * ANIMATED GLASS THEME — Smooth glass surface transitions on dark mode toggle.
 * Identical to KOLi version.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const DURATION = 280;
const EASING = Easing.inOut(Easing.ease);

const GlassContext = createContext(null);

export function AnimatedGlassProvider({ children }) {
  const { isDark } = useTheme();
  const progress = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isDark ? 1 : 0,
      duration: DURATION,
      easing: EASING,
      useNativeDriver: false,
    }).start();
  }, [isDark, progress]);

  const glass = useMemo(() => ({
    blurIntensity: 50,
    blurLayerOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    overlayOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    specularOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    cardBgIOS: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.45)', 'rgba(17,17,17,1)'] }),
    cardBgAndroid: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.95)', 'rgba(17,17,17,1)'] }),
    cardBgWeb: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.55)', 'rgba(17,17,17,1)'] }),
    borderColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.14)'] }),
    borderTopColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.22)'] }),
    borderBottomColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(200,210,230,0.2)', 'rgba(255,255,255,0.05)'] }),
    bottomShineOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    shadowOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.3] }),
    shadowRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    screenBg: progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(235,235,235,1)', 'rgba(0,0,0,1)'] }),
  }), [progress]);

  return (
    <GlassContext.Provider value={glass}>
      {children}
    </GlassContext.Provider>
  );
}

export function useAnimatedGlassTheme() {
  return useContext(GlassContext);
}
