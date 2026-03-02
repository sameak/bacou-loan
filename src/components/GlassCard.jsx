/**
 * GLASS CARD — Copied from KOLi (unchanged)
 */

import React from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { borderRadius } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useAnimatedGlassTheme } from '../hooks/useAnimatedGlassTheme';

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

let BlurView = null;
if (isIOS) {
  BlurView = require('expo-blur').BlurView;
}

const GlassCard = React.memo(function GlassCard({ children, style, showBottomShine }) {
  const { isDark } = useTheme();
  const glass = useAnimatedGlassTheme();

  const cardBg = isWeb ? glass.cardBgWeb : isAndroid ? glass.cardBgAndroid : glass.cardBgIOS;

  return (
    <Animated.View style={[styles.outer, style]}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: cardBg },
          isIOS && isDark && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.32,
            shadowRadius: 14,
          },
          isIOS && !isDark && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 5,
          },
          isAndroid && { elevation: isDark ? 4 : 2 },
          isWeb && {
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 6px 24px rgba(0,0,0,0.1)',
          },
        ]}
      >
        <Animated.View style={styles.decorativeClip} pointerEvents="none">
          {isIOS && BlurView && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: glass.blurLayerOpacity }]}>
              <BlurView intensity={glass.blurIntensity} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
            </Animated.View>
          )}
          {isIOS && (
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.fill, { opacity: glass.overlayOpacity }]} />
          )}
          <Animated.View style={[styles.specular, { opacity: glass.specularOpacity }]} />
          <Animated.View style={[styles.edge, { borderColor: glass.borderColor, borderTopColor: glass.borderTopColor, borderBottomColor: glass.borderBottomColor }]} />
          {showBottomShine && (
            <Animated.View style={[styles.bottomShine, { opacity: glass.bottomShineOpacity }]} />
          )}
        </Animated.View>
        <Animated.View style={styles.content}>
          {children}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outer: { borderRadius: borderRadius.xl },
  card: { borderRadius: borderRadius.xl },
  decorativeClip: { ...StyleSheet.absoluteFillObject, borderRadius: borderRadius.xl, overflow: 'hidden' },
  fill: { backgroundColor: 'rgba(255,255,255,0.15)' },
  specular: {
    position: 'absolute', top: 0, left: '8%', right: '8%', height: '35%',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 80, borderBottomRightRadius: 80, zIndex: 0,
  },
  edge: { ...StyleSheet.absoluteFillObject, borderRadius: borderRadius.xl, borderWidth: 0.5, zIndex: 0 },
  bottomShine: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl, zIndex: 0,
  },
  content: { position: 'relative', zIndex: 1 },
});

export default GlassCard;
