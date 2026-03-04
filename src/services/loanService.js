/**
 * LOAN SERVICE — CRUD + schedule generation + accrual calculation
 *
 * Collections:
 *   /loans/{loanId}                    — loan document
 *   /loans/{loanId}/schedule/{id}      — fixed mode schedule entries
 *   /loans/{loanId}/payments/{id}      — all payment records
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUid() {
  return auth.currentUser?.uid;
}

function getUserInfo() {
  const user = auth.currentUser;
  return {
    uid: user?.uid ?? '',
    name: user?.displayName || user?.email || 'Unknown',
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Parse 'YYYY-MM-DD' → Date (local time, never UTC) */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format Date → 'YYYY-MM-DD' */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add i periods (weekly = 7 days, monthly = calendar month) to startDate string */
function addPeriods(startDateStr, frequency, i) {
  const d = parseDate(startDateStr);
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7 * i);
  } else {
    // monthly
    d.setMonth(d.getMonth() + i);
  }
  return formatDate(d);
}

/** Absolute difference in days between two date strings */
export function dateDiffDays(fromStr, toStr) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

/** Today as 'YYYY-MM-DD' */
export function today() {
  return formatDate(new Date());
}

// ── Schedule Generation ───────────────────────────────────────────────────────

/**
 * Generate a fixed-mode repayment schedule.
 * Returns an array of period objects (NOT yet written to Firestore).
 */
export function generateSchedule(loan) {
  let balance = loan.currentPrincipal;
  const periods = [];

  for (let i = 1; i <= loan.totalPeriods; i++) {
    const interestDue = loan.interestBasis === 'flat'
      ? loan.originalPrincipal * (loan.interestRate / 100)
      : balance * (loan.interestRate / 100);

    // Equal principal installments for P+I; 0 for interest-only
    const principalDue = loan.repaymentType === 'interest_only'
      ? 0
      : balance / (loan.totalPeriods - i + 1);

    if (loan.repaymentType === 'principal_and_interest') {
      balance = balance - principalDue;
    }

    periods.push({
      periodNumber: i,
      dueDate: addPeriods(loan.startDate, loan.frequency, i),
      principalDue: round2(principalDue),
      interestDue: round2(interestDue),
      totalDue: round2(principalDue + interestDue),
      status: 'upcoming',
      paidAmount: 0,
      paidDate: null,
      notes: '',
    });
  }

  return periods;
}

/**
 * Calculate accrued interest for an open-ended loan up to toDate.
 * Uses daily rate = interestRate/100/30.
 */
export function calcAccruedInterest(loan, toDateStr = today()) {
  const fromStr = loan.lastPaymentDate ?? loan.startDate;
  const days = dateDiffDays(fromStr, toDateStr);
  const principal = loan.interestBasis === 'flat'
    ? loan.originalPrincipal
    : loan.currentPrincipal;
  const dailyRate = (loan.interestRate / 100) / 30;
  return round2(principal * dailyRate * days);
}

// ── Loan CRUD ─────────────────────────────────────────────────────────────────

/**
 * Create a loan (and its schedule if fixed mode).
 * Returns the new loan id.
 */
export async function createLoan(loanData) {
  const uid = getUid();
  if (!uid) throw new Error('Not authenticated');

  const { name: userName } = getUserInfo();

  const loan = {
    ownerId: uid,
    borrowerId: loanData.borrowerId,
    borrowerName: loanData.borrowerName,
    currency: loanData.currency || 'USD',
    originalPrincipal: loanData.originalPrincipal,
    currentPrincipal: loanData.originalPrincipal,
    interestRate: loanData.interestRate,
    interestBasis: loanData.interestBasis,
    repaymentType: loanData.repaymentType,
    frequency: loanData.frequency,
    scheduleMode: loanData.scheduleMode,
    totalPeriods: loanData.totalPeriods ?? null,
    startDate: loanData.startDate,
    lastPaymentDate: null,
    status: 'active',
    totalRepaid: 0,
    totalInterestPaid: 0,
    notes: loanData.notes ?? '',
    parentLoanId: loanData.parentLoanId ?? null,
    createdBy: uid,
    createdByName: userName,
    createdAt: serverTimestamp(),
  };

  const loanRef = await addDoc(collection(db, 'loans'), loan);
  const loanId = loanRef.id;

  // Generate and write schedule for fixed mode
  if (loanData.scheduleMode === 'fixed' && loanData.totalPeriods > 0) {
    const periods = generateSchedule({ ...loan, currentPrincipal: loanData.originalPrincipal });
    const batch = writeBatch(db);
    for (const period of periods) {
      const periodRef = doc(collection(db, 'loans', loanId, 'schedule'));
      batch.set(periodRef, period);
    }
    await batch.commit();
  }

  return loanId;
}

/**
 * Update loan fields.
 */
export async function updateLoan(loanId, fields) {
  await updateDoc(doc(db, 'loans', loanId), fields);
}

/**
 * Edit loan fields (currency, interestRate, totalPeriods, startDate,
 * repaymentType, interestBasis, frequency, scheduleMode, notes, etc.).
 * Handles schedule regeneration for fixed loans and schedule cleanup
 * when switching to open mode.
 */
export async function editLoan(loanId, updates, originalLoan) {
  const { uid, name: userName } = getUserInfo();
  await updateDoc(doc(db, 'loans', loanId), {
    ...updates,
    updatedBy: uid,
    updatedByName: userName,
    updatedAt: serverTimestamp(),
  });

  const switchingToOpen  = updates.scheduleMode === 'open'  && originalLoan.scheduleMode === 'fixed';
  const switchingToFixed = updates.scheduleMode === 'fixed' && originalLoan.scheduleMode === 'open';
  const staysFixed = originalLoan.scheduleMode === 'fixed' && !switchingToOpen;

  const scheduleFieldChanged = staysFixed && (
    (updates.interestRate  !== undefined && updates.interestRate  !== originalLoan.interestRate)  ||
    (updates.totalPeriods  !== undefined && updates.totalPeriods  !== originalLoan.totalPeriods)  ||
    (updates.startDate     !== undefined && updates.startDate     !== originalLoan.startDate)     ||
    (updates.repaymentType !== undefined && updates.repaymentType !== originalLoan.repaymentType) ||
    (updates.interestBasis !== undefined && updates.interestBasis !== originalLoan.interestBasis) ||
    (updates.frequency     !== undefined && updates.frequency     !== originalLoan.frequency)
  );

  if (switchingToOpen) {
    // Delete all unpaid schedule docs when switching to open-ended mode
    const snap = await getDocs(collection(db, 'loans', loanId, 'schedule'));
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      if (d.data().status !== 'paid') batch.delete(d.ref);
    });
    await batch.commit();
  } else if (switchingToFixed) {
    // Generate a full new schedule when switching from open to fixed
    const updatedLoan = { ...originalLoan, ...updates };
    await regenerateRemainingSchedule(updatedLoan, 1);
  } else if (scheduleFieldChanged) {
    const updatedLoan = { ...originalLoan, ...updates };
    const snap = await getDocs(collection(db, 'loans', loanId, 'schedule'));
    const unpaid = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.status !== 'paid')
      .sort((a, b) => a.periodNumber - b.periodNumber);
    const fromPeriod = unpaid.length > 0 ? unpaid[0].periodNumber : 1;
    await regenerateRemainingSchedule(updatedLoan, fromPeriod);
  }
}

/**
 * Delete a loan and all its subcollections (schedule + payments).
 */
export async function deleteLoan(loanId) {
  const batch = writeBatch(db);

  // Delete schedule entries
  const scheduleDocs = await getDocs(collection(db, 'loans', loanId, 'schedule'));
  scheduleDocs.forEach(d => batch.delete(d.ref));

  // Delete payment records
  const paymentDocs = await getDocs(collection(db, 'loans', loanId, 'payments'));
  paymentDocs.forEach(d => batch.delete(d.ref));

  // Delete the loan itself
  batch.delete(doc(db, 'loans', loanId));
  await batch.commit();
}

/**
 * Listen to all loans for the current user.
 */
export function listenLoans(callback) {
  const uid = getUid();
  if (!uid) return () => {};

  const q = query(collection(db, 'loans'));

  return onSnapshot(q, snap => {
    const loans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    loans.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });
    callback(loans);
  }, err => console.error('loan listener error:', err));
}

/**
 * Listen to a single loan document in real-time.
 */
export function listenLoan(loanId, callback) {
  return onSnapshot(
    doc(db, 'loans', loanId),
    snap => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    },
    err => console.error('loan detail listener error:', err)
  );
}

/**
 * Listen to loans for a specific borrower in real-time.
 */
export function listenLoansByBorrower(borrowerId, callback) {
  const uid = getUid();
  if (!uid) return () => {};
  const q = query(
    collection(db, 'loans'),
    where('borrowerId', '==', borrowerId)
  );
  return onSnapshot(q, snap => {
    const loans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    loans.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(loans);
  }, err => console.error('borrower loans listener error:', err));
}

/**
 * Fetch loans for a specific borrower.
 */
export async function getLoansByBorrower(borrowerId) {
  const uid = getUid();
  if (!uid) return [];

  const q = query(
    collection(db, 'loans'),
    where('borrowerId', '==', borrowerId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Schedule CRUD ─────────────────────────────────────────────────────────────

/**
 * Fetch the schedule for a loan (fixed mode).
 */
export async function getSchedule(loanId) {
  const snap = await getDocs(collection(db, 'loans', loanId, 'schedule'));
  const periods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  periods.sort((a, b) => a.periodNumber - b.periodNumber);
  return periods;
}

/**
 * Listen to schedule in real-time.
 */
export function listenSchedule(loanId, callback) {
  return onSnapshot(
    collection(db, 'loans', loanId, 'schedule'),
    snap => {
      const periods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      periods.sort((a, b) => a.periodNumber - b.periodNumber);
      callback(periods);
    },
    err => console.error('schedule listener error:', err)
  );
}

/**
 * Regenerate and replace schedule entries from a given period onwards.
 * Used after top-up (merge) on fixed-mode loans.
 */
export async function regenerateRemainingSchedule(loan, fromPeriodNumber) {
  const batch = writeBatch(db);

  // Delete all future (unpaid) schedule entries
  const snap = await getDocs(collection(db, 'loans', loan.id, 'schedule'));
  const toDelete = snap.docs.filter(d => {
    const data = d.data();
    return data.periodNumber >= fromPeriodNumber && data.status !== 'paid';
  });
  toDelete.forEach(d => batch.delete(d.ref));

  // Calculate remaining periods count
  const remainingPeriods = (loan.totalPeriods ?? 0) - fromPeriodNumber + 1;
  if (remainingPeriods <= 0) {
    await batch.commit();
    return;
  }

  // Generate new schedule from fromPeriodNumber
  // Adjust startDate to be last dueDate - 1 period (so addPeriods(i=1) gives fromPeriodNumber's date)
  // Find the previous paid period's dueDate to use as virtual startDate
  const paidDocs = snap.docs
    .filter(d => d.data().periodNumber < fromPeriodNumber && d.data().status === 'paid')
    .map(d => d.data())
    .sort((a, b) => b.periodNumber - a.periodNumber);

  let virtualStart = loan.startDate;
  if (paidDocs.length > 0) {
    // virtual start = last paid period's dueDate - 1 period
    const lastPaidDate = paidDocs[0].dueDate;
    const d = parseDate(lastPaidDate);
    if (loan.frequency === 'weekly') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    virtualStart = formatDate(d);
  }

  const tempLoan = {
    ...loan,
    totalPeriods: remainingPeriods,
    startDate: virtualStart,
    originalPrincipal: loan.originalPrincipal,
    currentPrincipal: loan.currentPrincipal,
  };

  const newPeriods = generateSchedule(tempLoan);
  for (let i = 0; i < newPeriods.length; i++) {
    const period = {
      ...newPeriods[i],
      periodNumber: fromPeriodNumber + i,
    };
    const periodRef = doc(collection(db, 'loans', loan.id, 'schedule'));
    batch.set(periodRef, period);
  }

  await batch.commit();
}

// ── Payments ──────────────────────────────────────────────────────────────────

/**
 * Record a payment and update loan totals.
 * For fixed mode: optionally link to a schedule period and update its status.
 * For open mode: updates lastPaymentDate and accrual tracking.
 */
export async function recordPayment(loanId, paymentData) {
  const { principalAmount = 0, interestAmount = 0, date, daysAccrued, schedulePeriodId, notes = '' } = paymentData;

  const totalAmount = round2(principalAmount + interestAmount);

  // Fetch current loan state
  const loanSnap = await getDoc(doc(db, 'loans', loanId));
  if (!loanSnap.exists()) throw new Error('Loan not found');
  const loan = { id: loanId, ...loanSnap.data() };

  const batch = writeBatch(db);

  const { uid: payUid, name: payName } = getUserInfo();

  // 1. Add payment record
  const paymentRef = doc(collection(db, 'loans', loanId, 'payments'));
  batch.set(paymentRef, {
    date,
    principalAmount: round2(principalAmount),
    interestAmount: round2(interestAmount),
    totalAmount,
    daysAccrued: daysAccrued ?? null,
    schedulePeriodId: schedulePeriodId ?? null,
    notes,
    createdBy: payUid,
    createdByName: payName,
    createdAt: serverTimestamp(),
  });

  // 2. Update loan totals
  const newPrincipal = round2(loan.currentPrincipal - principalAmount);
  const newTotalRepaid = round2((loan.totalRepaid ?? 0) + principalAmount);
  const newTotalInterestPaid = round2((loan.totalInterestPaid ?? 0) + interestAmount);

  const loanUpdate = {
    currentPrincipal: Math.max(0, newPrincipal),
    totalRepaid: newTotalRepaid,
    totalInterestPaid: newTotalInterestPaid,
    lastPaymentDate: date,
  };

  // Update status if fully paid
  if (newPrincipal <= 0) {
    loanUpdate.status = 'paid';
  }

  batch.update(doc(db, 'loans', loanId), loanUpdate);

  // 3. Update schedule period status (fixed mode)
  if (schedulePeriodId) {
    const periodRef = doc(db, 'loans', loanId, 'schedule', schedulePeriodId);
    const periodSnap = await getDoc(periodRef);
    if (periodSnap.exists()) {
      const period = periodSnap.data();
      const newPaidAmount = round2((period.paidAmount ?? 0) + totalAmount);
      const newStatus = newPaidAmount >= period.totalDue ? 'paid' : 'partial';
      batch.update(periodRef, { paidAmount: newPaidAmount, paidDate: date, status: newStatus });
    }
  }

  await batch.commit();
  return paymentRef.id;
}

/**
 * Edit an existing payment and adjust loan totals accordingly.
 */
export async function editPayment(loanId, paymentId, oldPayment, newData) {
  const { principalAmount = 0, interestAmount = 0, date, notes = '' } = newData;
  const totalAmount = round2(principalAmount + interestAmount);

  const loanSnap = await getDoc(doc(db, 'loans', loanId));
  if (!loanSnap.exists()) throw new Error('Loan not found');
  const loan = loanSnap.data();

  const { uid, name: userName } = getUserInfo();

  // Diffs relative to old payment
  const principalDiff = round2(principalAmount - (oldPayment.principalAmount ?? 0));
  const interestDiff  = round2(interestAmount  - (oldPayment.interestAmount  ?? 0));

  const newCurrentPrincipal    = round2((loan.currentPrincipal    ?? 0) - principalDiff);
  const newTotalRepaid         = round2((loan.totalRepaid         ?? 0) + principalDiff);
  const newTotalInterestPaid   = round2((loan.totalInterestPaid   ?? 0) + interestDiff);

  const batch = writeBatch(db);

  // 1. Update payment doc
  batch.update(doc(db, 'loans', loanId, 'payments', paymentId), {
    principalAmount: round2(principalAmount),
    interestAmount:  round2(interestAmount),
    totalAmount,
    date,
    notes,
    updatedBy:   uid,
    updatedByName: userName,
    updatedAt:   serverTimestamp(),
  });

  // 2. Recalculate lastPaymentDate if date changed
  let lastPaymentDate = loan.lastPaymentDate;
  if (oldPayment.date !== date) {
    const paymentsSnap = await getDocs(collection(db, 'loans', loanId, 'payments'));
    lastPaymentDate = null;
    paymentsSnap.docs.forEach(d => {
      if (d.id === paymentId) return; // use new date below
      const pd = d.data().date;
      if (pd && (!lastPaymentDate || pd > lastPaymentDate)) lastPaymentDate = pd;
    });
    if (!lastPaymentDate || date > lastPaymentDate) lastPaymentDate = date;
  }

  const loanUpdate = {
    currentPrincipal:  Math.max(0, newCurrentPrincipal),
    totalRepaid:       Math.max(0, newTotalRepaid),
    totalInterestPaid: Math.max(0, newTotalInterestPaid),
    lastPaymentDate,
    updatedBy:    uid,
    updatedByName: userName,
    updatedAt:    serverTimestamp(),
  };

  // Un-mark paid if principal goes positive again
  if (loan.status === 'paid' && newCurrentPrincipal > 0) loanUpdate.status = 'active';

  batch.update(doc(db, 'loans', loanId), loanUpdate);

  // 3. Update linked schedule period if any
  if (oldPayment.schedulePeriodId) {
    const periodRef  = doc(db, 'loans', loanId, 'schedule', oldPayment.schedulePeriodId);
    const periodSnap = await getDoc(periodRef);
    if (periodSnap.exists()) {
      const period     = periodSnap.data();
      const oldTotal   = round2((oldPayment.principalAmount ?? 0) + (oldPayment.interestAmount ?? 0));
      const newPaid    = Math.max(0, round2((period.paidAmount ?? 0) - oldTotal + totalAmount));
      const newStatus  = newPaid >= period.totalDue ? 'paid' : newPaid > 0 ? 'partial' : 'upcoming';
      batch.update(periodRef, { paidAmount: newPaid, paidDate: date, status: newStatus });
    }
  }

  await batch.commit();
}

/**
 * Delete a payment and reverse its effect on loan totals.
 */
export async function deletePayment(loanId, paymentId, payment) {
  const loanSnap = await getDoc(doc(db, 'loans', loanId));
  if (!loanSnap.exists()) throw new Error('Loan not found');
  const loan = loanSnap.data();

  const { uid, name: userName } = getUserInfo();

  // Find new lastPaymentDate excluding this payment
  const paymentsSnap = await getDocs(collection(db, 'loans', loanId, 'payments'));
  let lastPaymentDate = null;
  paymentsSnap.docs.forEach(d => {
    if (d.id === paymentId) return;
    const pd = d.data().date;
    if (pd && (!lastPaymentDate || pd > lastPaymentDate)) lastPaymentDate = pd;
  });

  const newCurrentPrincipal  = round2((loan.currentPrincipal    ?? 0) + (payment.principalAmount ?? 0));
  const newTotalRepaid       = Math.max(0, round2((loan.totalRepaid        ?? 0) - (payment.principalAmount ?? 0)));
  const newTotalInterestPaid = Math.max(0, round2((loan.totalInterestPaid  ?? 0) - (payment.interestAmount  ?? 0)));

  const batch = writeBatch(db);

  batch.delete(doc(db, 'loans', loanId, 'payments', paymentId));

  const loanUpdate = {
    currentPrincipal:  newCurrentPrincipal,
    totalRepaid:       newTotalRepaid,
    totalInterestPaid: newTotalInterestPaid,
    lastPaymentDate,
    updatedBy:    uid,
    updatedByName: userName,
    updatedAt:    serverTimestamp(),
  };

  if (loan.status === 'paid' && newCurrentPrincipal > 0) loanUpdate.status = 'active';

  batch.update(doc(db, 'loans', loanId), loanUpdate);

  // Revert linked schedule period
  if (payment.schedulePeriodId) {
    const periodRef  = doc(db, 'loans', loanId, 'schedule', payment.schedulePeriodId);
    const periodSnap = await getDoc(periodRef);
    if (periodSnap.exists()) {
      const period   = periodSnap.data();
      const oldTotal = round2((payment.principalAmount ?? 0) + (payment.interestAmount ?? 0));
      const newPaid  = Math.max(0, round2((period.paidAmount ?? 0) - oldTotal));
      const newStatus = newPaid >= period.totalDue ? 'paid' : newPaid > 0 ? 'partial' : 'upcoming';
      batch.update(periodRef, { paidAmount: newPaid, status: newStatus, paidDate: lastPaymentDate ?? null });
    }
  }

  await batch.commit();
}

/**
 * Fetch all payment records for a loan, newest first.
 */
export async function getPayments(loanId) {
  const snap = await getDocs(collection(db, 'loans', loanId, 'payments'));
  const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  payments.sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    const ta = a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?.seconds ?? 0;
    return tb - ta;
  });
  return payments;
}

/**
 * Fetch all payments for a list of loans, enriched with loan context.
 * Used by BorrowerDetailScreen to show unified payment history.
 */
export async function getBorrowerPayments(loans) {
  const allPayments = [];
  for (const loan of loans) {
    const snap = await getDocs(collection(db, 'loans', loan.id, 'payments'));
    const payments = snap.docs.map(d => ({
      id: d.id,
      loanId: loan.id,
      loanCurrency: loan.currency,
      loanOriginalPrincipal: loan.originalPrincipal,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrowerName,
      ...d.data(),
    }));
    allPayments.push(...payments);
  }
  allPayments.sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
  });
  return allPayments;
}

/**
 * Listen to payments in real-time.
 */
export function listenPayments(loanId, callback) {
  return onSnapshot(
    collection(db, 'loans', loanId, 'payments'),
    snap => {
      const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      payments.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
      });
      callback(payments);
    },
    err => console.error('payments listener error:', err)
  );
}

// ── Top-Up ────────────────────────────────────────────────────────────────────

/**
 * Top-up: merge into existing loan.
 * Adds amount to currentPrincipal, regenerates remaining schedule.
 */
export async function topUpMerge(loanId, amount, notes = '') {
  const loanSnap = await getDoc(doc(db, 'loans', loanId));
  if (!loanSnap.exists()) throw new Error('Loan not found');
  const loan = { id: loanId, ...loanSnap.data() };

  const newPrincipal = round2(loan.currentPrincipal + amount);
  await updateDoc(doc(db, 'loans', loanId), {
    currentPrincipal: newPrincipal,
    notes: notes || loan.notes,
  });

  // Regenerate remaining schedule for fixed mode
  if (loan.scheduleMode === 'fixed') {
    // Find first unpaid period
    const snap = await getDocs(collection(db, 'loans', loanId, 'schedule'));
    const unpaid = snap.docs
      .map(d => d.data())
      .filter(p => p.status !== 'paid')
      .sort((a, b) => a.periodNumber - b.periodNumber);

    if (unpaid.length > 0) {
      await regenerateRemainingSchedule(
        { ...loan, currentPrincipal: newPrincipal },
        unpaid[0].periodNumber
      );
    }
  }
}

/**
 * Top-up as new linked loan (shares borrower, sets parentLoanId).
 */
export async function topUpNewLoan(parentLoan, amount, notes = '') {
  const newLoanData = {
    borrowerId: parentLoan.borrowerId,
    borrowerName: parentLoan.borrowerName,
    currency: parentLoan.currency,
    originalPrincipal: amount,
    interestRate: parentLoan.interestRate,
    interestBasis: parentLoan.interestBasis,
    repaymentType: parentLoan.repaymentType,
    frequency: parentLoan.frequency,
    scheduleMode: parentLoan.scheduleMode,
    totalPeriods: parentLoan.totalPeriods,
    startDate: today(),
    notes,
    parentLoanId: parentLoan.id,
  };
  return createLoan(newLoanData);
}

// ── Status helpers ────────────────────────────────────────────────────────────

/**
 * Update overdue status for all active fixed loans.
 * Call on app startup to mark past-due entries.
 */
export async function refreshOverdueStatuses(loans) {
  const todayStr = today();
  const batch = writeBatch(db);
  let hasChanges = false;

  for (const loan of loans) {
    if (loan.scheduleMode !== 'fixed' || loan.status === 'paid' || loan.status === 'written_off') continue;

    const snap = await getDocs(collection(db, 'loans', loan.id, 'schedule'));
    let loanIsOverdue = false;

    snap.docs.forEach(d => {
      const period = d.data();
      if (period.status === 'upcoming' && period.dueDate < todayStr) {
        batch.update(d.ref, { status: 'overdue' });
        hasChanges = true;
        loanIsOverdue = true;
      }
    });

    if (loanIsOverdue && loan.status !== 'overdue') {
      batch.update(doc(db, 'loans', loan.id), { status: 'overdue' });
      hasChanges = true;
    }
  }

  if (hasChanges) await batch.commit();
}

/**
 * Write off (dead) loan — marks status as 'written_off', freezes accrual.
 */
export async function writeOffLoan(loanId) {
  const { uid, name: userName } = getUserInfo();
  await updateDoc(doc(db, 'loans', loanId), {
    status: 'written_off',
    updatedBy: uid,
    updatedByName: userName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark a loan as fully paid.
 */
export async function markLoanPaid(loanId) {
  await updateDoc(doc(db, 'loans', loanId), {
    status: 'paid',
    currentPrincipal: 0,
  });
}

// ── Currency formatting ───────────────────────────────────────────────────────

export function formatCurrency(amount, currency) {
  const n = Number(amount ?? 0);
  if (currency === 'KHR') {
    return '៛' + n.toLocaleString();
  }
  if (currency === 'KRW') {
    return '₩' + n.toLocaleString();
  }
  if (currency === 'USD') {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return currency + ' ' + n.toLocaleString();
}
