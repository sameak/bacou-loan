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

  /** fs(size) — returns size+2 for Khmer, otherwise size */
  const fs = useCallback((size) => language === 'km' ? size + 2 : size, [language]);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, fs }}>
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
