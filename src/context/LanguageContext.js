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

  /** fs(size) — same size for all languages; lineHeight ratios stay consistent so Khmer diacritics don't clip */
  const fs = useCallback((size) => size, []);

  /**
   * ff(weight) — system font for English, Koh Santepheap for Khmer.
   * Heavy weights (600+) → Bold variant; others → Regular.
   */
  const ff = useCallback((weight) => {
    if (language !== 'km') return { fontWeight: String(weight) };
    const heavy = ['600', '700', '800', '900'];
    return { fontFamily: heavy.includes(String(weight)) ? 'KohSantepheap_700Bold' : 'KohSantepheap_400Regular' };
  }, [language]);

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
