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

  /** fs(size) — same size for all languages */
  const fs = useCallback((size) => size, []);

  /**
   * lh(lineHeight) — returns Khmer-adjusted lineHeight.
   * Khmer Sangam MN needs ~1.65× ratio vs ~1.35× for English.
   * Pass the English lineHeight value; Khmer gets ×1.25 boost.
   * e.g. lh(19) → 19 (en) or 24 (km)
   */
  const lh = useCallback((lineHeight) => {
    return language === 'km' ? Math.round(lineHeight * 1.25) : lineHeight;
  }, [language]);

  /** ff(weight) — system font for all languages; iOS system font handles Khmer glyphs natively with correct metrics */
  const ff = useCallback((weight) => {
    return { fontWeight: String(weight) };
  }, []);

  /** fi() — no special font override needed; system font handles Khmer input correctly */
  const fi = useCallback(() => ({}), []);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, fs, ff, fi, lh }}>
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
