/**
 * THEME CONTEXT — Dark mode with system detection
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import storage, { STORAGE_KEYS } from '../services/storage';
import { darkColors, lightColors } from './index';

const ThemeContext = createContext();

export function ThemeProvider({ children, initialTheme }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState(initialTheme || 'system');
  const [loaded, setLoaded] = useState(!!initialTheme);

  useEffect(() => {
    if (!initialTheme) {
      storage.get(STORAGE_KEYS.THEME_MODE, 'system').then(saved => {
        setThemeModeState(saved);
        setLoaded(true);
      });
    }
  }, [initialTheme]);

  const setThemeMode = useCallback(async (mode) => {
    setThemeModeState(mode);
    await storage.set(STORAGE_KEYS.THEME_MODE, mode);
  }, []);

  const isDark = themeMode === 'system'
    ? systemScheme === 'dark'
    : themeMode === 'dark';

  const colors = isDark ? darkColors : lightColors;

  const value = React.useMemo(
    () => ({ colors, isDark, themeMode, setThemeMode }),
    [colors, isDark, themeMode, setThemeMode]
  );

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
