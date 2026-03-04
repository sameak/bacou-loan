/**
 * NOTIFICATION SERVICE — Schedule local push reminders for upcoming loan payments.
 *
 * Preferences stored in AsyncStorage under REMINDER_KEY.
 * Notifications are rescheduled on every app open (called from AppNavigator after data loads).
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// ── Notification handler (show alert + sound when app is in foreground) ────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const REMINDER_KEY = '@reminder_prefs';
export const DEFAULT_PREFS = { enabled: false, days: 2, time: '09:00' };

/** Request permission; returns 'granted' | 'denied' | 'undetermined' */
export async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

/** Get current permission status without prompting */
export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Schedule one notification per upcoming unpaid period (fixed-mode loans only).
 * Cancels all previously scheduled notifications first.
 * No-ops if prefs.enabled is false.
 */
export async function schedulePaymentReminders(loans) {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  const prefs = raw ? JSON.parse(raw) : DEFAULT_PREFS;
  if (!prefs.enabled) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const [hh, mm] = prefs.time.split(':').map(Number);

  for (const loan of loans) {
    if (loan.scheduleMode !== 'fixed') continue;
    if (loan.status === 'paid' || loan.status === 'written_off') continue;

    let snap;
    try {
      snap = await getDocs(collection(db, 'loans', loan.id, 'schedule'));
    } catch (_) {
      continue;
    }

    for (const docSnap of snap.docs) {
      const p = docSnap.data();
      if (p.status === 'paid') continue;
      if (!p.dueDate) continue;

      // Build trigger = dueDate - prefs.days days, at prefs.time
      const due = new Date(p.dueDate);
      due.setHours(0, 0, 0, 0);
      const trigger = new Date(due);
      trigger.setDate(trigger.getDate() - prefs.days);
      trigger.setHours(hh, mm, 0, 0);

      if (trigger <= now) continue; // skip past triggers

      const fmtAmt =
        loan.currency === 'KHR'
          ? '៛' + Math.round(p.totalDue ?? 0).toLocaleString()
          : '$' + Math.round(p.totalDue ?? 0).toLocaleString('en-US');

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Payment Due Soon',
            body: `${loan.borrowerName} — ${fmtAmt} due ${p.dueDate}`,
            data: { loanId: loan.id },
          },
          trigger,
        });
      } catch (_) {
        // Ignore individual scheduling errors (e.g. too many notifications)
      }
    }
  }
}

/** Cancel all scheduled payment reminders */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
