/**
 * SKELETON — Loading placeholders (copied from KOLi)
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export const Skeleton = ({ width = '100%', height = 14, radius = 6, style, isDark }) => {
  const anim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: isDark ? '#444' : '#C8C8C8', opacity: anim }, style]}
    />
  );
};

export const SkeletonRow = ({ isDark, first = false }) => (
  <View style={[styles.row, !first && styles.rowBorder]}>
    <Skeleton width={40} height={40} radius={12} isDark={isDark} />
    <View style={styles.info}>
      <Skeleton width="55%" height={13} isDark={isDark} style={{ marginBottom: 6 }} />
      <Skeleton width="35%" height={11} isDark={isDark} />
    </View>
    <Skeleton width={60} height={13} isDark={isDark} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.15)' },
  info: { flex: 1 },
});

export default Skeleton;
