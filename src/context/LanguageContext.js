/**
 * LANGUAGE CONTEXT — en + km
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import storage, { STORAGE_KEYS } from '../services/storage';

const LanguageContext = createContext();

export function LanguageProvider({ children, initialLanguage }) {
  const [language, setLanguageState] = useState(initialLanguage || 'en');
  const [loaded, setLoaded] = useState(!!initialLanguage);

  useEffect(() => {
    if (!initialLanguage) {
      storage.get(STORAGE_KEYS.LANGUAGE, 'en').then(saved => {
        setLanguageState(saved || 'en');
        setLoaded(true);
      });
    }
  }, [initialLanguage]);

  const setLanguage = useCallback(async (lang) => {
    setLanguageState(lang);
    await storage.set(STORAGE_KEYS.LANGUAGE, lang);
  }, []);

  /** fs(size) — +10% in Khmer mode for better readability */
  const fs = useCallback((size) => language === 'km' ? size * 1.1 : size, [language]);

  /**
   * ff(weight) — always uses Koh Santepheap (supports both Latin + Khmer),
   * so Khmer text renders correctly in all screens regardless of app language.
   * Heavy weights (600+) → Bold variant; others → Regular.
   */
  const ff = useCallback((weight) => {
    const heavy = ['600', '700', '800', '900'];
    return { fontFamily: heavy.includes(String(weight)) ? 'KohSantepheap_700Bold' : 'KohSantepheap_400Regular' };
  }, []);

  /**
   * fi() — font for TextInput fields. Always uses Koh Santepheap so user-typed
   * Khmer text renders correctly regardless of the app's display language.
   */
  const fi = useCallback(() => ({ fontFamily: 'KohSantepheap_400Regular' }), []);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, fs, ff, fi }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

/** t(strings, language) — fallback to 'en' */
export function t(strings, lang) {
  return strings[lang] || strings.en || '';
}
