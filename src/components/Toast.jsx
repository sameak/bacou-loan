/**
 * TOAST — Copied from KOLi (unchanged)
 * Mount once in App.js: <Toast />
 * Call from anywhere: Toast.show({ text: 'Saved!', type: 'success' })
 */

import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let _ref = null;

const Toast = forwardRef((_, ref) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const config = useRef({ text: '', type: 'success' });
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const hideTimer = useRef(null);

  const hide = () => {
    translateY.value = withTiming(-120, { duration: 280 });
    opacity.value = withTiming(0, { duration: 280 });
  };

  const show = ({ text, type = 'success', duration = 3000 }) => {
    config.current = { text, type };
    runOnJS(forceUpdate)();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    translateY.value = withTiming(0, { duration: 320 });
    opacity.value = withTiming(1, { duration: 320 });
    hideTimer.current = setTimeout(() => hide(), duration);
  };

  useImperativeHandle(ref, () => ({ show, hide }));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const { type, text } = config.current;
  const isSuccess = type === 'success';
  const isError = type === 'error';
  const icon = isSuccess ? 'checkmark-circle' : isError ? 'alert-circle' : 'information-circle';
  const color = isSuccess ? '#10B981' : isError ? '#EF4444' : '#F59E0B';

  return (
    <Animated.View style={[styles.container, animStyle, { top: insets.top + 12 }]} pointerEvents="none">
      <View style={[styles.pill, { borderColor: color + '30' }]}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={styles.text} numberOfLines={2}>{text}</Text>
      </View>
    </Animated.View>
  );
});

Toast.show = (opts) => _ref?.show(opts);
Toast.hide = () => _ref?.hide();
Toast._setRef = (r) => { _ref = r; };

export default Toast;

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, zIndex: 9999, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1,
    backgroundColor: '#1C1C1E', maxWidth: 380, width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
      android: { elevation: 10 },
    }),
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFFFFF', lineHeight: 20 },
});
