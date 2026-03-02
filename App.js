/**
 * BACOU LOAN — App Entry Point
 */

import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider } from './src/theme/ThemeContext';
import { AnimatedGlassProvider } from './src/hooks/useAnimatedGlassTheme';
import { LanguageProvider } from './src/context/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from './src/components/Toast';
import storage, { STORAGE_KEYS } from './src/services/storage';

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

  // Load theme + language in parallel before rendering providers
  useEffect(() => {
    Promise.all([
      storage.get(STORAGE_KEYS.THEME_MODE, 'system'),
      storage.get(STORAGE_KEYS.LANGUAGE, 'en'),
    ]).then(([theme, language]) => {
      setPrefs({ theme, language });
    });
  }, []);

  if (!prefs) return null;

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
