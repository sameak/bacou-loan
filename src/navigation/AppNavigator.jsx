/**
 * APP NAVIGATOR — Auth gate + Main tabs + Modal stack
 *
 * Tab bar uses real Apple Liquid Glass on iOS 26+ via @callstack/liquid-glass.
 * Falls back to a multi-layer BlurView approximation on older devices.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView,
  LiquidGlassContainerView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  PlatformColor,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import SettingsScreen from '../screens/Settings/SettingsScreen';
import SessionsScreen from '../screens/Settings/SessionsScreen';
import { recordSession } from '../services/sessionService';

const AuthStack     = createNativeStackNavigator();
const MainStack     = createNativeStackNavigator();
const Tab           = createBottomTabNavigator();
const BorrowerStack = createNativeStackNavigator();
const LoanStack     = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

const TAB_LABELS = {
  en: { dashboard: 'Dashboard', borrowers: 'Borrowers', loans: 'Loans', settings: 'Settings' },
  km: { dashboard: 'ទំព័រដើម', borrowers: 'អ្នកខ្ចី', loans: 'ប្រាក់កម្ចី', settings: 'ការកំណត់' },
};

const TAB_CONFIGS = [
  { name: 'DashboardTab', icon: 'grid',         iconOutline: 'grid-outline' },
  { name: 'BorrowersTab', icon: 'people',        iconOutline: 'people-outline' },
  { name: 'LoansTab',     icon: 'document-text', iconOutline: 'document-text-outline' },
  { name: 'SettingsTab',  icon: 'settings',      iconOutline: 'settings-outline' },
];

const ACCENT           = '#6366F1';
const TAB_BAR_HEIGHT   = 72;   // row padding + icon + gap + label
const TAB_BOTTOM_GAP   = 16;   // gap between bar bottom and safe-area bottom

// ─── Tab items (shared between native & fallback) ─────────────────────────────

function TabItems({ state, navigation, labels, isDark, useNativeColor }) {
  return (
    <>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg     = TAB_CONFIGS[index];

        // On iOS 26+ with LiquidGlass, use PlatformColor so the system
        // automatically picks the right contrast colour against the glass.
        const iconColor = focused
          ? ACCENT
          : useNativeColor
            ? PlatformColor('secondaryLabelColor')
            : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)';

        const labelColor = focused
          ? ACCENT
          : useNativeColor
            ? PlatformColor('secondaryLabelColor')
            : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)';

        return (
          <TouchableOpacity
            key={route.key}
            style={tabStyles.item}
            activeOpacity={0.7}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            onLongPress={() =>
              navigation.emit({ type: 'tabLongPress', target: route.key })
            }
          >
            {/* Active pill — small glass-tinted capsule behind the icon */}
            {focused && (
              <View
                pointerEvents="none"
                style={[
                  tabStyles.activePill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(99,102,241,0.22)'
                      : 'rgba(99,102,241,0.13)',
                    borderColor: isDark
                      ? 'rgba(99,102,241,0.22)'
                      : 'rgba(99,102,241,0.10)',
                  },
                ]}
              />
            )}

            <Ionicons
              name={focused ? cfg.icon : cfg.iconOutline}
              size={22}
              color={iconColor}
            />
            <Text style={[tabStyles.label, { color: labelColor }]}>
              {labels[index]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// ─── Liquid Glass Tab Bar ─────────────────────────────────────────────────────

function LiquidGlassTabBar({ state, navigation }) {
  const { colors, isDark } = useTheme();
  const { language }       = useLanguage();
  const insets             = useSafeAreaInsets();
  const tl     = TAB_LABELS[language] || TAB_LABELS.en;
  const labels = [tl.dashboard, tl.borrowers, tl.loans, tl.settings];

  const bottom = insets.bottom + TAB_BOTTOM_GAP;

  const tabItems = (
    <TabItems
      state={state}
      navigation={navigation}
      labels={labels}
      isDark={isDark}
      useNativeColor={isLiquidGlassSupported}
    />
  );

  // ── iOS 26+: real Apple Liquid Glass ────────────────────────────────────────
  if (isLiquidGlassSupported) {
    return (
      <View style={[tabStyles.wrap, { bottom }]} pointerEvents="box-none">
        {/*
          LiquidGlassContainerView lets the bar glass and the active-pill glass
          "meld" together when close — the signature iOS 26 morphing behaviour.
        */}
        <LiquidGlassContainerView spacing={24} style={tabStyles.nativeWrap}>
          {/* Main bar */}
          <LiquidGlassView
            style={tabStyles.nativeBar}
            effect="regular"
            interactive={false}
          >
            <View style={tabStyles.row}>{tabItems}</View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </View>
    );
  }

  // ── Fallback: layered BlurView approximation ─────────────────────────────────
  //
  // Layer order (bottom → top):
  //   1. BlurView          – the frosted base (scatters background content)
  //   2. Tint overlay      – thin semi-transparent wash (warms/cools the glass)
  //   3. Specular strip    – bright 2 px line at the very top edge (simulates
  //                          light catching the physical rim of curved glass —
  //                          the most distinctive glass feature)
  //   4. Specular fade     – 6 px gradient-like fade below the specular strip
  //   5. Rim border        – 1 px white border around the whole pill
  //   6. Tab content       – icons + labels (highest z-index)
  return (
    <View style={[tabStyles.wrap, { bottom }]}>
      <BlurView
        intensity={isDark ? 62 : 78}
        tint={isDark ? 'dark' : 'light'}
        style={tabStyles.blur}
      >
        {/* 2. Tint overlay */}
        <View
          pointerEvents="none"
          style={[
            tabStyles.overlay,
            {
              backgroundColor: isDark
                ? 'rgba(12,12,24,0.44)'
                : 'rgba(255,255,255,0.36)',
            },
          ]}
        />

        {/* 3. Specular strip — the bright glass rim at the top */}
        <View
          pointerEvents="none"
          style={[
            tabStyles.specularStrip,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.28)'
                : 'rgba(255,255,255,0.72)',
            },
          ]}
        />

        {/* 4. Specular fade — softer glow just below the strip */}
        <View
          pointerEvents="none"
          style={[
            tabStyles.specularFade,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(255,255,255,0.22)',
            },
          ]}
        />

        {/* 5. Glass rim border */}
        <View
          pointerEvents="none"
          style={[
            tabStyles.rim,
            {
              borderColor: isDark
                ? 'rgba(255,255,255,0.16)'
                : 'rgba(255,255,255,0.82)',
            },
          ]}
        />

        {/* 6. Tab content */}
        <View style={tabStyles.row}>{tabItems}</View>
      </BlurView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    // Deep, soft shadow — gives the bar physical "lift"
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 32,
      },
      android: { elevation: 24 },
    }),
  },

  // ── Native glass (iOS 26+)
  nativeWrap: {
    // LiquidGlassContainerView needs to fill the bar area
  },
  nativeBar: {
    borderRadius: 28,
    overflow: 'hidden',
  },

  // ── Fallback layers
  blur: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    zIndex: 0,
  },
  specularStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 2,
  },
  specularFade: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    height: 8,
    zIndex: 2,
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    zIndex: 3,
  },

  // ── Shared
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    zIndex: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  activePill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 4,
    right: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
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
    </SettingsStack.Navigator>
  );
}

function MainTabs() {
  const insets   = useSafeAreaInsets();
  const bottomPad = TAB_BAR_HEIGHT + TAB_BOTTOM_GAP + insets.bottom;

  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      sceneContainerStyle={{ paddingBottom: bottomPad }}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} />
      <Tab.Screen name="BorrowersTab" component={BorrowerStackNav} />
      <Tab.Screen name="LoansTab"     component={LoanStackNav} />
      <Tab.Screen name="SettingsTab"  component={SettingsStackNav} />
    </Tab.Navigator>
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
      <MainStack.Screen name="EditLoan"       component={EditLoanScreen} />
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
      if (u) recordSession();
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

  return (
    <NavigationContainer>
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
