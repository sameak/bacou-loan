/**
 * APP NAVIGATOR — Auth gate + Main tabs + Modal stack
 *
 * Tab bar uses real Apple Liquid Glass on iOS 26+ via @callstack/liquid-glass.
 * Falls back to a multi-layer BlurView approximation on older devices.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
let LiquidGlassView = null;
let LiquidGlassContainerView = null;
let isLiquidGlassSupported = false;
try {
  const lg = require('@callstack/liquid-glass');
  LiquidGlassView = lg.LiquidGlassView;
  LiquidGlassContainerView = lg.LiquidGlassContainerView;
  isLiquidGlassSupported = lg.isLiquidGlassSupported ?? false;
} catch (_) {
  // Native module not linked — fall back to BlurView
}
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Dimensions,
  PanResponder,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import RAnimated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DataProvider } from '../context/DataContext';
import { AppLockProvider, useAppLock } from '../context/AppLockContext';
import AppLockScreen from '../screens/AppLockScreen';

// Screens
import AuthScreen from '../screens/Auth/AuthScreen';
import OTPScreen from '../screens/Auth/OTPScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import BorrowerListScreen from '../screens/Borrowers/BorrowerListScreen';
import BorrowerDetailScreen from '../screens/Borrowers/BorrowerDetailScreen';
import CreateBorrowerScreen from '../screens/Borrowers/CreateBorrowerScreen';
import LoanListScreen from '../screens/Loans/LoanListScreen';
import LoanDetailScreen from '../screens/Loans/LoanDetailScreen';
import CreateLoanScreen from '../screens/Loans/CreateLoanScreen';
import RecordPaymentScreen from '../screens/Loans/RecordPaymentScreen';
import TopUpLoanScreen from '../screens/Loans/TopUpLoanScreen';
import EditLoanScreen from '../screens/Loans/EditLoanScreen';
import LoanCalculatorScreen from '../screens/Loans/LoanCalculatorScreen';
import ReportsScreen from '../screens/Reports/ReportsScreen';
import ExchangeRatesScreen from '../screens/Rates/ExchangeRatesScreen';
import AssetsScreen from '../screens/Assets/AssetsScreen';
import ChatListScreen from '../screens/Chat/ChatListScreen';
import ChatRoomScreen from '../screens/Chat/ChatRoomScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import SessionsScreen from '../screens/Settings/SessionsScreen';
import SetPINScreen   from '../screens/Settings/SetPINScreen';
import AdminScreen    from '../screens/Settings/AdminScreen';
import CapitalScreen    from '../screens/Settings/CapitalScreen';
import AppearanceScreen from '../screens/Settings/AppearanceScreen';
import RemindersScreen  from '../screens/Settings/RemindersScreen';
import { recordSession } from '../services/sessionService';
import { schedulePaymentReminders, registerForPushNotifications } from '../services/notificationService';
import { useData } from '../context/DataContext';
import { TabBarScrollProvider, useTabBar } from '../context/TabBarContext';

const AuthStack     = createNativeStackNavigator();
const MainStack     = createNativeStackNavigator();
const Tab           = createBottomTabNavigator();
const BorrowerStack = createNativeStackNavigator();
const LoanStack     = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

const TAB_LABELS = {
  en: { dashboard: 'Dashboard', borrowers: 'Borrowers', loans: 'Loans', menu: 'Menu' },
  km: { dashboard: 'ទំព័រដើម', borrowers: 'អតិថិជន', loans: 'ប្រាក់កម្ចី', menu: 'ម៉ឺនុយ' },
};

const TAB_CONFIGS = [
  { name: 'DashboardTab', icon: 'grid',         iconOutline: 'grid-outline' },
  { name: 'BorrowersTab', icon: 'people',        iconOutline: 'people-outline' },
  { name: 'LoansTab',     icon: 'document-text', iconOutline: 'document-text-outline' },
  { name: 'SettingsTab',  icon: 'menu',          iconOutline: 'menu-outline' },
];

const ACCENT           = '#00C2B2';
const TAB_BAR_HEIGHT   = 88;   // row padding + icon + gap + label
const TAB_BOTTOM_GAP   = 0;    // bar sits flush against the safe-area bottom

// ─── Tab item (animated, scale on focus) ──────────────────────────────────────

const TabItem = React.memo(function TabItem({
  cfg, focused, activeColor, inactiveColor, label, language, fs, ff,
  showActivePill, isDark,
}) {
  const scale = useSharedValue(focused ? 1.0 : 0.88);
  const prevFocused = useRef(focused);

  useEffect(() => {
    if (prevFocused.current === focused) return;
    prevFocused.current = focused;
    scale.value = withSpring(focused ? 1.0 : 0.88, { damping: 14, stiffness: 280, mass: 0.7 });
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = focused ? activeColor : inactiveColor;

  return (
    <View style={tabStyles.item}>
      {showActivePill && focused && (
        <View
          pointerEvents="none"
          style={[tabStyles.activePill, {
            backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.13)',
            borderColor:     isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.10)',
          }]}
        />
      )}
      <RAnimated.View style={iconStyle}>
        <Ionicons name={focused ? cfg.icon : cfg.iconOutline} size={22} color={color} />
      </RAnimated.View>
      <Text style={[tabStyles.label, ff('600'), { letterSpacing: 0, color, fontSize: fs(11.5), ...(language !== 'km' && { lineHeight: 16 }) }]}>
        {label}
      </Text>
    </View>
  );
});

// ─── Liquid Glass Tab Bar ─────────────────────────────────────────────────────

function LiquidGlassTabBar({ state, navigation }) {
  const { isDark }         = useTheme();
  const { language, fs, ff } = useLanguage();
  const insets             = useSafeAreaInsets();
  const { width: screenW } = Dimensions.get('window');
  const tl     = TAB_LABELS[language] || TAB_LABELS.en;
  const labels = [tl.dashboard, tl.borrowers, tl.loans, tl.menu];
  const bottom = insets.bottom + TAB_BOTTOM_GAP;

  const tabCount = state.routes.length;
  const tabW     = (screenW - 40) / tabCount; // 40 = left:20 + right:20

  // ── Auto-hide on scroll
  const { tabVisible } = useTabBar();
  const hideY = TAB_BAR_HEIGHT + insets.bottom + 20;
  const tabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabVisible ? (1 - tabVisible.value) * hideY : 0 }],
  }));
  useEffect(() => {
    if (tabVisible) tabVisible.value = withTiming(1, { duration: 200 });
  }, [state.index]);

  // ── Sliding pill (spring physics)
  const pillX   = useSharedValue(state.index * tabW);
  const shimmer = useSharedValue(0);
  const bloom   = useSharedValue(0);
  const isMounted = useRef(false);

  useEffect(() => {
    pillX.value = withSpring(state.index * tabW, { damping: 20, stiffness: 200, mass: 0.85 });
    if (!isMounted.current) { isMounted.current = true; return; }
    // Fast specular flash
    shimmer.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }),
    );
    // Soft bloom
    bloom.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
  }, [state.index, tabW]);

  // ── Glass press bubble
  const [pressedIndex,   setPressedIndex]   = useState(-1);
  const [dragPreviewIdx, setDragPreviewIdx] = useState(-1);
  const bubbleScale  = useSharedValue(0);
  const iridescence  = useSharedValue(0);

  const handlePressIn = (index) => {
    setPressedIndex(index);
    bubbleScale.value = withSpring(1, { damping: 11, stiffness: 420, mass: 0.55 });
    iridescence.value = 0;
    iridescence.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false,
    );
  };
  const handlePressOut = () => {
    bubbleScale.value = withSpring(0, { damping: 14, stiffness: 380, mass: 0.5 });
    iridescence.value = withTiming(0, { duration: 250 });
  };

  const pillAnim   = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value + 6 }] }));
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  const bloomAnim  = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value + 6 },
      { scaleX: 1 + bloom.value * 0.06 },
      { scaleY: 1 + bloom.value * 0.10 },
    ],
    opacity: bloom.value * 0.50,
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bubbleScale.value }],
    opacity: bubbleScale.value,
  }));
  const iridStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      iridescence.value,
      [0, 0.17, 0.33, 0.50, 0.67, 0.83, 1],
      [
        'rgba(210,170,255,0.85)',
        'rgba(170,215,255,0.85)',
        'rgba(170,255,230,0.85)',
        'rgba(255,215,170,0.85)',
        'rgba(255,170,200,0.85)',
        'rgba(230,170,255,0.85)',
        'rgba(210,170,255,0.85)',
      ],
    ),
  }));

  const activeColor    = isDark ? '#FFFFFF' : '#1C1C1E';
  const inactiveColor  = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.35)';
  const pillColor      = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)';
  const tintColor      = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)';
  const shellBgColor   = isDark ? 'rgba(28,28,30,0.65)' : 'rgba(242,242,247,0.92)';

  const lastTapTimes = useRef({});

  // ── Drag-to-switch refs (stable across renders)
  const pressStartRef  = useRef({ x: 0, time: 0, idx: 0 });
  const dragIdxRef     = useRef(-1);
  const isDraggingRef  = useRef(false);
  const bubbleTimerRef = useRef(null);
  // Keep latest values accessible inside the PanResponder without recreating it
  const handlerCtx = useRef({});
  handlerCtx.current = {
    state, navigation, tabW, tabVisible, handlePressIn, handlePressOut,
    lastTapTimes, pillX, setPressedIndex, setDragPreviewIdx,
    tabCount: state.routes.length,
  };

  const rowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (evt) => {
        const { tabW, tabCount, setDragPreviewIdx } = handlerCtx.current;
        const x   = evt.nativeEvent.locationX;
        const idx = Math.max(0, Math.min(tabCount - 1, Math.floor(x / tabW)));
        pressStartRef.current = { x, time: Date.now(), idx, startPillX: handlerCtx.current.pillX.value };
        dragIdxRef.current    = idx;
        isDraggingRef.current = false;
        setDragPreviewIdx(idx);
        // Delay bubble so a fast swipe never shows it — cleared in onPanResponderMove if drag starts
        clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => {
          if (!isDraggingRef.current) handlerCtx.current.handlePressIn(idx);
        }, 60);
      },

      onPanResponderMove: (evt) => {
        const { tabW, tabCount, pillX, setPressedIndex, setDragPreviewIdx, handlePressOut } = handlerCtx.current;
        const x  = evt.nativeEvent.locationX;
        const dx = x - pressStartRef.current.x;

        if (Math.abs(dx) > 8 && !isDraggingRef.current) {
          isDraggingRef.current = true;
          // Cancel the bubble timer and dismiss any bubble already visible
          clearTimeout(bubbleTimerRef.current);
          handlePressOut();
        }

        if (isDraggingRef.current) {
          // ── Pill tracks finger 1:1 from its start position (smooth, no spring)
          const rawPillX = pressStartRef.current.startPillX + dx;
          pillX.value = Math.max(0, Math.min((tabCount - 1) * tabW, rawPillX));

          // ── Update visual active tab as finger crosses boundaries
          const newIdx = Math.max(0, Math.min(tabCount - 1, Math.floor(x / tabW)));
          if (newIdx !== dragIdxRef.current) {
            dragIdxRef.current = newIdx;
            setPressedIndex(newIdx);
            setDragPreviewIdx(newIdx);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      },

      onPanResponderRelease: () => {
        const { state, navigation, tabW, tabVisible, lastTapTimes, handlePressOut, pillX, setDragPreviewIdx } = handlerCtx.current;
        clearTimeout(bubbleTimerRef.current);
        handlePressOut();
        setDragPreviewIdx(-1);

        if (!isDraggingRef.current) {
          // ── Treat as tap (same logic as before)
          const idx = pressStartRef.current.idx;
          const now = Date.now();
          const isDoubleTap = state.index === idx && (now - (lastTapTimes.current[idx] ?? 0) < 300);
          lastTapTimes.current[idx] = isDoubleTap ? 0 : now;
          if (isDoubleTap) {
            DeviceEventEmitter.emit('tabBarScrollToTop', { index: idx });
            if (tabVisible) tabVisible.value = withTiming(1, { duration: 350 });
          } else {
            const route = state.routes[idx];
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (state.index !== idx && !event.defaultPrevented) navigation.navigate(route.name);
          }
        } else {
          // ── Drag release: spring pill to final tab, then navigate once
          const finalIdx = dragIdxRef.current;
          pillX.value = withSpring(finalIdx * tabW, { damping: 20, stiffness: 200, mass: 0.85 });
          if (finalIdx >= 0 && finalIdx !== state.index) {
            navigation.navigate(state.routes[finalIdx].name);
          }
        }

        isDraggingRef.current = false;
        dragIdxRef.current    = -1;
      },

      onPanResponderTerminate: () => {
        const { handlePressOut, pillX, tabW, state, setDragPreviewIdx } = handlerCtx.current;
        clearTimeout(bubbleTimerRef.current);
        handlePressOut();
        setDragPreviewIdx(-1);
        // Spring pill back to current focused tab
        pillX.value = withSpring(state.index * tabW, { damping: 20, stiffness: 200, mass: 0.85 });
        isDraggingRef.current = false;
        dragIdxRef.current    = -1;
      },
    })
  ).current;

  const makeTabItems = (showActivePill) => state.routes.map((route, index) => {
    // During drag, visually highlight the tab under the finger
    const focused = dragPreviewIdx >= 0 ? dragPreviewIdx === index : state.index === index;
    return (
      <TabItem
        key={route.key}
        cfg={TAB_CONFIGS[index]}
        focused={focused}
        activeColor={showActivePill ? (focused ? ACCENT : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)')) : activeColor}
        inactiveColor={inactiveColor}
        label={labels[index]}
        language={language}
        fs={fs}
        ff={ff}
        isDark={isDark}
        showActivePill={showActivePill}
      />
    );
  });

  // ── iOS 26+: real Apple Liquid Glass ────────────────────────────────────────
  // Uses individual Pressable per tab instead of PanResponder to avoid coordinate
  // issues caused by LiquidGlassContainerView/LiquidGlassView layout wrappers.
  if (isLiquidGlassSupported) {
    return (
      <RAnimated.View style={[tabStyles.wrap, { bottom }, tabAnimStyle]} pointerEvents="box-none">
        <LiquidGlassContainerView spacing={24} style={tabStyles.nativeWrap}>
          <LiquidGlassView style={tabStyles.nativeBar} effect="regular" interactive={false}>
            <View style={tabStyles.row}>
              {state.routes.map((route, index) => {
                const focused = state.index === index;
                return (
                  <Pressable
                    key={route.key}
                    style={({ pressed }) => [tabStyles.item, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                      const now = Date.now();
                      const isDoubleTap = state.index === index && (now - (lastTapTimes.current[index] ?? 0) < 300);
                      lastTapTimes.current[index] = isDoubleTap ? 0 : now;
                      if (isDoubleTap) {
                        DeviceEventEmitter.emit('tabBarScrollToTop', { index });
                        if (tabVisible) tabVisible.value = withTiming(1, { duration: 350 });
                      } else {
                        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                        if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name);
                      }
                    }}
                  >
                    <TabItem
                      cfg={TAB_CONFIGS[index]}
                      focused={focused}
                      activeColor={focused ? ACCENT : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)')}
                      inactiveColor={inactiveColor}
                      label={labels[index]}
                      language={language}
                      fs={fs}
                      ff={ff}
                      isDark={isDark}
                      showActivePill={true}
                    />
                  </Pressable>
                );
              })}
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
        {/* Light mode overlay: LiquidGlass respects iOS system dark mode, not the app theme.
            When app is light but system is dark, the glass renders dark — override it. */}
        {!isDark && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, {
              backgroundColor: 'rgba(235,235,240,0.82)',
              borderRadius: 28,
            }]}
          />
        )}
      </RAnimated.View>
    );
  }

  // ── Fallback: layered BlurView + animated sliding pill + shimmer + press bubble
  // tabBarRoot is a clean wrapper with no shadow/borderRadius so iOS compositing
  // doesn't clip Khmer diacritics that extend above the text bounding box.
  return (
    <RAnimated.View pointerEvents="box-none" style={[tabStyles.tabBarRoot, { bottom }, tabAnimStyle]}>
      {/* Visual glass bar — shadow/borderRadius contained here */}
      <View style={[tabStyles.outerShell, { shadowOpacity: isDark ? 0.35 : 0.12 }]}>
        <View style={[tabStyles.innerShell, { backgroundColor: shellBgColor }]}>
          {/* 1. Glass blur */}
          <BlurView
            intensity={isDark ? 62 : 78}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          {/* 2. DIAGNOSTIC: always force light — remove once confirmed */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(235,235,240,0.97)' }]} />
          {/* 3. Tint overlay */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: tintColor }]} />
          {/* 6. Bloom — soft expanding glow */}
          <RAnimated.View style={[tabStyles.pill, {
            width: tabW - 12,
            backgroundColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.95)',
          }, bloomAnim]} />
          {/* 7. Sliding pill indicator */}
          <RAnimated.View style={[tabStyles.pill, { width: tabW - 12, backgroundColor: pillColor }, pillAnim]} />
          {/* 8. Shimmer flash */}
          <RAnimated.View style={[tabStyles.pill, { width: tabW - 12, backgroundColor: '#FFFFFF' }, pillAnim, shimmerStyle]} />
        </View>
      </View>

      {/* 9. Tab items — outside outerShell so iOS shadow compositing doesn't clip Khmer diacritics */}
      <View style={tabStyles.tabsRow} {...rowPan.panHandlers}>{makeTabItems(false)}</View>

      {/* Glass press bubble — iridescent ring + frosted interior */}
      {pressedIndex >= 0 && (
        <RAnimated.View
          pointerEvents="none"
          style={[tabStyles.glassBubble, { left: pressedIndex * tabW + 2, width: tabW - 4 }, bubbleStyle]}
        >
          <RAnimated.View style={[StyleSheet.absoluteFillObject, tabStyles.glassBubbleRing, iridStyle]} />
          {Platform.OS === 'ios' ? (
            <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFillObject, { borderRadius: 26 }]} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.82)', borderRadius: 26 }]} />
          )}
        </RAnimated.View>
      )}
    </RAnimated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  // ── Native glass path (iOS 26+)
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 32 },
      android: { elevation: 24 },
    }),
  },
  nativeWrap: {},
  nativeBar: { borderRadius: 28, overflow: 'hidden' },

  // ── Fallback path (floating pill)
  // tabBarRoot: clean wrapper — no shadow, no borderRadius → no iOS compositing clip
  tabBarRoot: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: TAB_BAR_HEIGHT,
  },
  outerShell: {
    // fills tabBarRoot; shadow stays here so compositing clip is isolated
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  innerShell: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },

  // ── Glass layers
  specularStrip: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, zIndex: 2,
  },
  specularFade: {
    position: 'absolute', top: 2, left: 0, right: 0, height: 8, zIndex: 2,
  },
  borderRing: {
    ...StyleSheet.absoluteFillObject, borderRadius: 28, borderWidth: 1, zIndex: 3,
  },

  // ── Animated pill
  pill: {
    position: 'absolute',
    height: TAB_BAR_HEIGHT - 12, // 6px gap top + bottom
    top: 6,
    borderRadius: 22,
  },

  // ── Tab rows
  row: {                          // native glass path
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    zIndex: 4,
  },
  tabsRow: {                      // fallback path — inside clean tabBarRoot (no shadow), not inside outerShell
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  activePill: {                   // used in native glass path only
    position: 'absolute',
    top: 0, bottom: 0, left: 4, right: 4,
    borderRadius: 20, borderWidth: 1,
  },
  label: {},

  // ── Press bubble
  glassBubble: {
    position: 'absolute',
    height: TAB_BAR_HEIGHT + 20,
    top: -10,
    borderRadius: 26,
    overflow: 'hidden',
  },
  glassBubbleRing: { borderRadius: 26, borderWidth: 2 },
  glassBubbleHighlight: {
    position: 'absolute', top: 8, left: 14, right: 14, height: 16,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.72)',
  },
});

// ─── Stack Navigators ─────────────────────────────────────────────────────────

function BorrowerStackNav() {
  return (
    <BorrowerStack.Navigator screenOptions={{ headerShown: false }}>
      <BorrowerStack.Screen name="BorrowerList"  component={BorrowerListScreen} />
      <BorrowerStack.Screen name="BorrowerDetail" component={BorrowerDetailScreen} />
    </BorrowerStack.Navigator>
  );
}

function LoanStackNav() {
  return (
    <LoanStack.Navigator screenOptions={{ headerShown: false }}>
      <LoanStack.Screen name="LoanList"   component={LoanListScreen} />
      <LoanStack.Screen name="LoanDetail" component={LoanDetailScreen} />
    </LoanStack.Navigator>
  );
}

function SettingsStackNav() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsList" component={SettingsScreen} />
      <SettingsStack.Screen name="Sessions"     component={SessionsScreen} />
      <SettingsStack.Screen name="SetPIN"       component={SetPINScreen} />
      <SettingsStack.Screen name="Admin"        component={AdminScreen} />
      <SettingsStack.Screen name="Capital"    component={CapitalScreen} />
      <SettingsStack.Screen name="Appearance" component={AppearanceScreen} />
      <SettingsStack.Screen name="Reminders"  component={RemindersScreen} />
    </SettingsStack.Navigator>
  );
}

function MainTabs() {
  const insets   = useSafeAreaInsets();
  const { isDark } = useTheme();
  const bottomPad = TAB_BAR_HEIGHT + TAB_BOTTOM_GAP + insets.bottom;
  const { loans, loansLoaded } = useData();

  // Schedule payment reminders once loans are loaded (keeps notifications current each app open)
  useEffect(() => {
    if (!loansLoaded) return;
    schedulePaymentReminders(loans).catch(() => {});
  }, [loansLoaded]);

  return (
    <TabBarScrollProvider>
      <Tab.Navigator
        tabBar={(props) => <LiquidGlassTabBar {...props} />}
        detachInactiveScreens={false}
        sceneContainerStyle={{
          paddingBottom: bottomPad,
          backgroundColor: isDark ? '#000000' : '#EBEBEB',
        }}
        screenOptions={{ headerShown: false, lazy: false, animation: 'fade' }}
      >
        <Tab.Screen name="DashboardTab" component={DashboardScreen} />
        <Tab.Screen name="BorrowersTab" component={BorrowerStackNav} />
        <Tab.Screen name="LoansTab"     component={LoanStackNav} />
        <Tab.Screen name="SettingsTab"  component={SettingsStackNav} />
      </Tab.Navigator>
    </TabBarScrollProvider>
  );
}

function MainStackNav() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false, presentation: 'modal' }}>
      <MainStack.Screen name="Tabs"           component={MainTabs}               options={{ presentation: 'card' }} />
      <MainStack.Screen name="CreateBorrower" component={CreateBorrowerScreen} />
      <MainStack.Screen name="CreateLoan"     component={CreateLoanScreen} />
      <MainStack.Screen name="RecordPayment"  component={RecordPaymentScreen} />
      <MainStack.Screen name="TopUpLoan"      component={TopUpLoanScreen} />
      <MainStack.Screen name="EditLoan"         component={EditLoanScreen} />
      <MainStack.Screen name="LoanCalculator" component={LoanCalculatorScreen} />
      <MainStack.Screen name="Reports"        component={ReportsScreen} />
      <MainStack.Screen name="ExchangeRates"  component={ExchangeRatesScreen} />
      <MainStack.Screen name="Assets"         component={AssetsScreen} />
      <MainStack.Screen name="ChatList"       component={ChatListScreen} />
      <MainStack.Screen name="ChatRoom"       component={ChatRoomScreen} />
    </MainStack.Navigator>
  );
}

function MainStackWithLock() {
  const { isLocked } = useAppLock();
  return (
    <>
      <MainStackNav />
      {isLocked && <AppLockScreen />}
    </>
  );
}

export default function AppNavigator() {
  const { isDark } = useTheme();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) {
        recordSession();
        registerForPushNotifications(u.uid);
      }
    });
    return unsub;
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#000' : '#EBEBEB' }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const navTheme = isDark
    ? { ...DarkTheme,    colors: { ...DarkTheme.colors,    background: '#000000' } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#EBEBEB' } };

  return (
    <NavigationContainer theme={navTheme}>
      {user ? (
        <DataProvider>
          <AppLockProvider>
            <MainStackWithLock />
          </AppLockProvider>
        </DataProvider>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Auth" component={AuthScreen} />
          <AuthStack.Screen name="OTP"  component={OTPScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
