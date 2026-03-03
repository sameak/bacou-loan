/**
 * BACOU LOAN — App Entry Point
 */

import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { KohSantepheap_400Regular, KohSantepheap_700Bold } from '@expo-google-fonts/koh-santepheap';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { ThemeProvider } from './src/theme/ThemeContext';
import { AnimatedGlassProvider } from './src/hooks/useAnimatedGlassTheme';
import { LanguageProvider } from './src/context/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from './src/components/Toast';
import storage, { STORAGE_KEYS } from './src/services/storage';

// Keep splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

function AppInner() {
  const toastRef = useRef(null);

  // Register singleton ref so Toast.show() works globally
  const setToastRef = (ref) => {
    toastRef.current = ref;
    Toast._setRef(ref);
  };

  return (
    <>
      <AppNavigator />
      <Toast ref={setToastRef} />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  const [prefs, setPrefs] = useState(null);
  const [fontsLoaded] = useFonts({ KohSantepheap_400Regular, KohSantepheap_700Bold });

  // Load theme + language in parallel before rendering providers
  useEffect(() => {
    Promise.all([
      storage.get(STORAGE_KEYS.THEME_MODE, 'system'),
      storage.get(STORAGE_KEYS.LANGUAGE, 'en'),
    ]).then(([theme, language]) => {
      setPrefs({ theme, language });
    });
  }, []);

  // Hide splash only when both prefs and fonts are ready
  useEffect(() => {
    if (prefs && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [prefs, fontsLoaded]);

  if (!prefs || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialTheme={prefs.theme}>
          <AnimatedGlassProvider>
            <LanguageProvider initialLanguage={prefs.language}>
              <AppInner />
            </LanguageProvider>
          </AnimatedGlassProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
