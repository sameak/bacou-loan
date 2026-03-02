/**
 * DATA CONTEXT — Single shared listeners + AsyncStorage cache.
 *
 * Strategy (instant data every open):
 *   1. On mount → read AsyncStorage cache → show data INSTANTLY (< 5ms)
 *   2. Firestore listeners start in parallel → when network arrives,
 *      update state + refresh cache silently in background
 *
 * This means after the very first open, the app shows data with zero
 * visible loading — the spinner only ever appears on first-ever launch.
 *
 * Cache is namespaced by uid so multi-user devices never see wrong data.
 *
 * Usage:
 *   const { loans, borrowers, loansLoaded, borrowersLoaded } = useData();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { listenLoans } from '../services/loanService';
import { listenBorrowers } from '../services/borrowerService';

const DataContext = createContext(null);

const cacheKey = (uid, type) => `data_cache_${uid}_${type}`;

async function readCache(uid, type) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid, type));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(uid, type, data) {
  AsyncStorage.setItem(cacheKey(uid, type), JSON.stringify(data)).catch(() => {});
}

export function DataProvider({ children }) {
  const [loans, setLoans] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loansLoaded, setLoansLoaded] = useState(false);
  const [borrowersLoaded, setBorrowersLoaded] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;

    // Step 1: load cache in parallel (instant, < 5ms from disk)
    if (uid) {
      Promise.all([
        readCache(uid, 'loans'),
        readCache(uid, 'borrowers'),
      ]).then(([cachedLoans, cachedBorrowers]) => {
        if (cachedLoans) {
          setLoans(cachedLoans);
          setLoansLoaded(true);
        }
        if (cachedBorrowers) {
          setBorrowers(cachedBorrowers);
          setBorrowersLoaded(true);
        }
      });
    }

    // Step 2: start Firestore listeners — update state + cache when network arrives
    const unsubLoans = listenLoans(data => {
      setLoans(data);
      setLoansLoaded(true);
      if (uid) writeCache(uid, 'loans', data);
    });

    const unsubBorrowers = listenBorrowers(data => {
      setBorrowers(data);
      setBorrowersLoaded(true);
      if (uid) writeCache(uid, 'borrowers', data);
    });

    return () => {
      unsubLoans();
      unsubBorrowers();
    };
  }, []);

  return (
    <DataContext.Provider value={{ loans, borrowers, loansLoaded, borrowersLoaded }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
