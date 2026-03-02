/**
 * STORAGE SERVICE — Simple local storage with in-memory cache.
 * Bacou-loan only persists preferences (theme, language).
 * Loan/borrower data lives in Firestore via their services.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  LANGUAGE: 'language',
  THEME_MODE: 'themeMode',
};

class StorageService {
  constructor() {
    this._cache = new Map();
  }

  async get(key, defaultValue = null) {
    if (this._cache.has(key)) {
      const val = this._cache.get(key);
      return val !== null && val !== undefined ? val : defaultValue;
    }
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) return defaultValue;
      const value = JSON.parse(raw);
      this._cache.set(key, value);
      return value;
    } catch {
      return defaultValue;
    }
  }

  getSync(key, defaultValue = null) {
    if (this._cache.has(key)) {
      const val = this._cache.get(key);
      return val !== null && val !== undefined ? val : defaultValue;
    }
    return defaultValue;
  }

  async set(key, value) {
    try {
      this._cache.set(key, value);
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async remove(key) {
    try {
      this._cache.delete(key);
      await AsyncStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async clear() {
    try {
      this._cache.clear();
      await AsyncStorage.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
}

export default new StorageService();
