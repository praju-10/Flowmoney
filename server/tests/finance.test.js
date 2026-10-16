import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, P } from './helpers.js';
import { monthSummary, yearHeatmap, salaryForMonth, runningRemaining } from '../src/services/financeService.js';
import { yearReport, monthReport } from '../src/services/reportService.js';
import { createTransaction, deleteTransaction, listTransactions } from '../src/services/transactionService.js';
import { createLoan, recordLoanPayment, getLoan, listLoans } from '../src/services/loanService.js';
import { setSalary } from '../src/services/profileService.js';
import { loadDemo, clearDemo } from '../src/seed/demo.js';
import { toPaise, formatINR, pct } from '../src/utils/money.js';
import { monthBounds, isValidDate } from '../src/utils/dates.js';

const tx = (db, o) => createTransaction(db, { description: '', ...o });
const loanInput = (o = {}) => ({ name: 'Home', lender: 'Bank', kind: 'home', original_principal_paise: P(1000000), outstanding_paise: P(500000),
  interest_rate_bps: 850, emi_paise: P(15000), due_day: 5, start_date: null, end_date: null, tenure_months: null, notes: '', ...o });

test('empty month: zeros everywhere, no NaN', () => {
  const db = freshDb();
  const s = monthSummary(db, '2026-05');
  assert.equal(s.income_paise, 0); assert.equal(s.spent_paise, 0); assert.equal(s.spent_pct, 0); assert.equal(s.saved_pct, 0);
  for (const g of Object.values(s.groups)) { assert.equal(g.total_paise, 0); assert.equal(g.pct_of_income, 0); }
});

test('salary history: a later raise never rewrites earlier months', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  setSalary(db, { amount_paise: P(120000), effective_from: '2026-03-01' });
  assert.equal(salaryForMonth(db, '2025-12'), 0);
  assert.equal(salaryForMonth(db, '2026-02'), P(100000));
  assert.equal(salaryForMonth(db, '2026-03'), P(120000));
  assert.equal(salaryForMonth(db, '2027-01'), P(120000));
});

test('totals: spent = loan + necessary + misc; savings separate; transfers excluded', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: P(4000) });
  tx(db, { type: 'expense', category_key: 'misc.dining', date: '2026-02-04', amount_paise: P(6000) });
  tx(db, { type: 'saving', date: '2026-02-05', amount_paise: P(10000) });
  tx(db, { type: 'transfer', date: '2026-02-06', amount_paise: P(50000) });
  const loan = createLoan(db, loanInput({ emi_paise: P(15000) }));
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000) });
  const s = monthSummary(db, '2026-02');
  assert.equal(s.groups.loan.total_paise, P(15000));
  assert.equal(s.groups.necessary.total_paise, P(4000));
  assert.equal(s.groups.misc.total_paise, P(6000));
  assert.equal(s.spent_paise, P(25000));
  assert.equal(s.saved_paise, P(10000));
  assert.equal(s.spent_pct, 25); assert.equal(s.saved_pct, 10);
});

test('an EMI is counted exactly once (not also as a generic expense)', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  const loan = createLoan(db, loanInput());
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000) });
  const rows = listTransactions(db, { month: '2026-02', page: 1, limit: 50, sort: 'date', dir: 'desc' });
  assert.equal(rows.total, 1);
  assert.equal(monthSummary(db, '2026-02').spent_paise, P(15000));
});

test('setting spent_includes_loans=0 moves loans out of "spent" and is labelled', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  const loan = createLoan(db, loanInput());
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000) });
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-06', amount_paise: P(1000) });
  db.prepare("UPDATE app_settings SET value='0' WHERE key='spent_includes_loans'").run();
  const s = monthSummary(db, '2026-02');
  assert.equal(s.spent_paise, P(1000));
  assert.match(s.calculation_note, /Loan repayments are shown separately/);
});

test('refund reduces its group and cannot push it below zero', () => {
  const db = freshDb();
  tx(db, { type: 'expense', category_key: 'misc.shopping', date: '2026-02-03', amount_paise: P(1000) });
  tx(db, { type: 'refund', category_key: 'misc.shopping', date: '2026-02-10', amount_paise: P(400) });
  assert.equal(monthSummary(db, '2026-02').groups.misc.total_paise, P(600));
  tx(db, { type: 'refund', category_key: 'misc.shopping', date: '2026-02-11', amount_paise: P(5000) });
  assert.equal(monthSummary(db, '2026-02').groups.misc.total_paise, 0);
});

test('type/category mismatches are rejected', () => {
  const db = freshDb();
  assert.throws(() => tx(db, { type: 'saving', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: 100 }), /cannot be filed/);
  assert.throws(() => tx(db, { type: 'expense', category_key: 'income', date: '2026-02-03', amount_paise: 100 }), /cannot be filed/);
});

test('month boundaries: Jan 31 vs Feb 1, and Dec → Jan year rollover', () => {
  const db = freshDb();
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-01-31', amount_paise: P(100) });
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-01', amount_paise: P(200) });
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2025-12-31', amount_paise: P(300) });
  assert.equal(monthSummary(db, '2026-01').groups.necessary.total_paise, P(100));
  assert.equal(monthSummary(db, '2026-02').groups.necessary.total_paise, P(200));
  assert.equal(monthSummary(db, '2025-12').groups.necessary.total_paise, P(300));
  assert.deepEqual(monthBounds('2025-12'), { start: '2025-12-01', end: '2026-01-01' });
});

test('duplicate EMI for the same loan+period is rejected; different period and corrections work', () => {
  const db = freshDb();
  const loan = createLoan(db, loanInput());
  const first = recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000) });
  assert.throws(() => recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-20', amount_paise: P(15000) }), /already recorded/);
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-03-05', amount_paise: P(15000) }); // next month is fine
  deleteTransaction(db, first.id); // correction workflow
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-06', amount_paise: P(15000) });
  assert.equal(monthSummary(db, '2026-02').groups.loan.total_paise, P(15000));
});

test('loan principal only changes from actuals or prepayments, and deleting restores it', () => {
  const db = freshDb();
  const loan = createLoan(db, loanInput({ outstanding_paise: P(500000) }));
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000) }); // no split given: NOT guessed
  assert.equal(getLoan(db, loan.id).outstanding_paise, P(500000));
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-03-05', amount_paise: P(15000), principal_paise: P(9000), interest_paise: P(6000) });
  assert.equal(getLoan(db, loan.id).outstanding_paise, P(491000));
  const pre = recordLoanPayment(db, loan.id, { kind: 'prepayment', date: '2026-03-20', amount_paise: P(50000) });
  assert.equal(getLoan(db, loan.id).outstanding_paise, P(441000));
  deleteTransaction(db, pre.id);
  assert.equal(getLoan(db, loan.id).outstanding_paise, P(491000));
});

test('principal + interest must equal the payment', () => {
  const db = freshDb();
  const loan = createLoan(db, loanInput());
  assert.throws(() => recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000), principal_paise: P(1), interest_paise: P(1) }), /must equal/);
});

test('database rollback: a failed payment leaves no partial records', () => {
  const db = freshDb();
  const loan = createLoan(db, loanInput({ outstanding_paise: P(1000) }));
  assert.throws(() => recordLoanPayment(db, loan.id, { kind: 'prepayment', date: '2026-02-05', amount_paise: P(5000) }), /exceeds the outstanding/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM transactions').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM loan_payments').get().n, 0);
  assert.equal(getLoan(db, loan.id).outstanding_paise, P(1000));
});

test('EMI status: paid / overdue / pending', () => {
  const db = freshDb();
  const loan = createLoan(db, loanInput({ due_day: 5 }));
  assert.equal(listLoans(db, '2020-01')[0].status, 'overdue'); // past month, unpaid
  assert.equal(listLoans(db, '2999-01')[0].status, 'pending'); // future month
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2020-01-05', amount_paise: P(15000) });
  assert.equal(listLoans(db, '2020-01')[0].status, 'paid');
});

test('heatmap distinguishes "no data" (null) from a real zero-after-refund month', () => {
  const db = freshDb();
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-03-03', amount_paise: P(500) });
  const h = yearHeatmap(db, 2026);
  assert.equal(h.groups.necessary[0], null);
  assert.equal(h.groups.necessary[2], P(500));
  assert.equal(h.groups.misc[2], null);
  tx(db, { type: 'expense', category_key: 'misc.other', date: '2026-04-03', amount_paise: P(500) });
  tx(db, { type: 'refund', category_key: 'misc.other', date: '2026-04-04', amount_paise: P(500) });
  assert.equal(yearHeatmap(db, 2026).groups.misc[3], 0);
});

test('editing/deleting a transaction updates totals immediately', () => {
  const db = freshDb();
  const t = tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: P(4000) });
  assert.equal(monthSummary(db, '2026-02').spent_paise, P(4000));
  deleteTransaction(db, t.id);
  assert.equal(monthSummary(db, '2026-02').spent_paise, 0);
});

test('search treats LIKE wildcards literally and filters by amount', () => {
  const db = freshDb();
  tx(db, { type: 'expense', category_key: 'misc.other', date: '2026-02-03', amount_paise: P(100), description: '50% off sale' });
  tx(db, { type: 'expense', category_key: 'misc.other', date: '2026-02-04', amount_paise: P(900), description: 'plain' });
  const q = { page: 1, limit: 50, sort: 'date', dir: 'desc' };
  assert.equal(listTransactions(db, { ...q, search: '%' }).total, 1);
  assert.equal(listTransactions(db, { ...q, search: "x' OR '1'='1" }).total, 0);
  assert.equal(listTransactions(db, { ...q, min_paise: P(500) }).total, 1);
});

test('demo data is flagged and clearDemo leaves real records alone', () => {
  const db = freshDb();
  const real = tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-01-10', amount_paise: P(777) });
  loadDemo(db, { year: 2026, upToMonth: 3 });
  const jan = monthSummary(db, '2026-01');
  assert.equal(jan.salary_paise, P(120000));
  assert.equal(jan.groups.loan.total_paise, P(25000));
  assert.equal(jan.groups.saving.total_paise, P(18000));
  clearDemo(db);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM transactions').get().n, 1);
  assert.equal(db.prepare('SELECT id FROM transactions').get().id, real.id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM loans').get().n, 0);
  assert.equal(salaryForMonth(db, '2026-01'), 0);
});

test('money helpers: paise conversion, INR grouping, percentages', () => {
  assert.equal(toPaise('₹1,20,000.50'), 12000050);
  assert.equal(toPaise(0.1 + 0.2), 30);
  assert.equal(toPaise(19.99), 1999);
  assert.equal(formatINR(12000000), '₹ 1,20,000');
  assert.equal(formatINR(123456789), '₹ 12,34,568');
  assert.equal(pct(1, 0), 0);
  assert.equal(pct(1, 3), 33.3);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2024-02-29'), true);
});

test('remaining = income − loan − saving − necessary − misc, and can go negative', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: P(4000) });
  tx(db, { type: 'expense', category_key: 'misc.dining', date: '2026-02-04', amount_paise: P(6000) });
  tx(db, { type: 'saving', date: '2026-02-05', amount_paise: P(10000) });
  const loan = createLoan(db, loanInput({ emi_paise: P(15000) }));
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000) });
  const s = monthSummary(db, '2026-02');
  assert.equal(s.remaining_paise, P(65000));
  assert.equal(s.remaining_pct, 65);
  tx(db, { type: 'expense', category_key: 'misc.shopping', date: '2026-02-06', amount_paise: P(70000) });
  assert.equal(monthSummary(db, '2026-02').remaining_paise, P(-5000)); // overspent: shown honestly
  tx(db, { type: 'income', date: '2026-02-07', amount_paise: P(5000) }); // extra income lifts it
  assert.equal(monthSummary(db, '2026-02').remaining_paise, 0);
});

test('remaining is 0 (not NaN) for an empty month, and negative with spend but no salary', () => {
  const db = freshDb();
  assert.equal(monthSummary(db, '2026-06').remaining_paise, 0);
  tx(db, { type: 'expense', category_key: 'misc.other', date: '2026-06-02', amount_paise: P(300) });
  const s = monthSummary(db, '2026-06');
  assert.equal(s.remaining_paise, P(-300));
  assert.equal(s.remaining_pct, 0);
});

test('running remaining after each entry follows date order, then entry order; transfers ignored; refunds add back', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  const a = tx(db, { type: 'expense', category_key: 'necessary.groceries', date: '2026-02-10', amount_paise: P(2000) });
  const b = tx(db, { type: 'expense', category_key: 'misc.dining', date: '2026-02-03', amount_paise: P(500) }); // earlier date, added later
  const t = tx(db, { type: 'transfer', date: '2026-02-04', amount_paise: P(9999) });
  const r = tx(db, { type: 'refund', category_key: 'misc.dining', date: '2026-02-12', amount_paise: P(200) });
  const sv = tx(db, { type: 'saving', date: '2026-02-12', amount_paise: P(1000) });
  const m = runningRemaining(db, '2026-02');
  assert.equal(m.get(b.id), P(99500));
  assert.equal(m.get(t.id), P(99500));
  assert.equal(m.get(a.id), P(97500));
  assert.equal(m.get(r.id), P(97700));
  assert.equal(m.get(sv.id), P(96700));
  // The transactions list exposes the same figure when filtered to a month
  const list = listTransactions(db, { month: '2026-02', page: 1, limit: 50, sort: 'date', dir: 'asc' });
  assert.equal(list.items.find((x) => x.id === a.id).remaining_after_paise, P(97500));
  assert.equal(listTransactions(db, { page: 1, limit: 50, sort: 'date', dir: 'asc' }).items[0].remaining_after_paise, undefined);
  // And it equals the month's overall remaining at the last entry
  assert.equal(m.get(sv.id), monthSummary(db, '2026-02').remaining_paise);
});

test('month status: a month is final only after its last date has passed', () => {
  const db = freshDb();
  assert.equal(monthSummary(db, '2026-01', new Date(2026, 0, 31, 23, 0)).month_status, 'in_progress');
  assert.equal(monthSummary(db, '2026-01', new Date(2026, 1, 1, 0, 5)).month_status, 'final');
  assert.equal(monthSummary(db, '2026-03', new Date(2026, 1, 10)).month_status, 'upcoming');
  assert.equal(monthSummary(db, '2025-12', new Date(2026, 0, 1)).month_status, 'final'); // year rollover
});

test('heatmap marks which months are completed', () => {
  const db = freshDb();
  const h = yearHeatmap(db, 2026, new Date(2026, 2, 10));
  assert.deepEqual(h.completed, [true, true, false, false, false, false, false, false, false, false, false, false]);
  assert.equal(yearHeatmap(db, 2025, new Date(2026, 2, 10)).completed.every(Boolean), true);
  assert.equal(yearHeatmap(db, 2027, new Date(2026, 2, 10)).completed.some(Boolean), false);
});

test('year report: month-end Necessary/Misc sums are final only for completed months', () => {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  tx(db, { type: 'expense', category_key: 'necessary.groceries', date: '2026-01-10', amount_paise: P(6000) });
  tx(db, { type: 'expense', category_key: 'misc.dining', date: '2026-01-11', amount_paise: P(1000) });
  tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: P(3000) });
  tx(db, { type: 'expense', category_key: 'misc.shopping', date: '2026-02-04', amount_paise: P(2000) });
  const rep = yearReport(db, 2026, new Date(2026, 1, 15)); // mid-February
  const [jan, feb, mar] = rep.months;
  assert.equal(jan.status, 'final'); assert.equal(jan.necessary_paise, P(6000)); assert.equal(jan.misc_paise, P(1000));
  assert.equal(feb.status, 'in_progress'); assert.equal(feb.necessary_paise, P(3000));
  assert.equal(mar.status, 'upcoming'); assert.equal(mar.has_data, true); // salary applies, but nothing is invented
  assert.equal(mar.necessary_paise, 0);
  assert.equal(rep.final_totals.necessary_paise, P(6000)); // February is not final yet
  assert.equal(rep.final_totals.misc_paise, P(1000));
  assert.equal(rep.final_totals.months_counted, 1);
  assert.equal(rep.final_totals.remaining_paise, P(93000));
  assert.equal(rep.totals.months_counted, 2); // upcoming months are excluded from averages
  assert.equal(rep.totals.avg_monthly_spent_paise, Math.round((P(7000) + P(5000)) / 2));
  assert.equal(jan.remaining_paise, P(93000));
});

test('year report on an empty database is all zeros with no NaN and no averages', () => {
  const db = freshDb();
  const rep = yearReport(db, 2026, new Date(2026, 5, 1));
  assert.equal(rep.months.length, 12);
  assert.equal(rep.months.every((m) => m.has_data === false && m.spent_paise === 0), true);
  assert.equal(rep.totals.avg_monthly_spent_paise, null);
  assert.equal(rep.totals.savings_rate_pct, 0);
});

test('month report: sub-categories net of refunds, comparison with previous month (incl. January → December)', () => {
  const db = freshDb();
  tx(db, { type: 'expense', category_key: 'necessary.groceries', date: '2026-01-10', amount_paise: P(5000) });
  tx(db, { type: 'expense', category_key: 'misc.dining', date: '2026-01-11', amount_paise: P(1000) });
  tx(db, { type: 'refund', category_key: 'misc.dining', date: '2026-01-12', amount_paise: P(400) });
  tx(db, { type: 'expense', category_key: 'necessary.groceries', date: '2025-12-10', amount_paise: P(4000) });
  const rep = monthReport(db, '2026-01', new Date(2026, 1, 15));
  assert.equal(rep.previous_month, '2025-12');
  assert.deepEqual(rep.subcategories.map((s) => [s.name, s.total_paise]), [['Groceries', P(5000)], ['Food & dining', P(600)]]);
  const nec = rep.comparison.find((c) => c.group === 'necessary');
  assert.equal(nec.change_pct, 25);
  assert.equal(rep.comparison.find((c) => c.group === 'saving').change_pct, null); // no previous data → no % invented
  assert.equal(rep.month_status, 'final');
});

test('fuel details are stored only for the Fuel category', () => {
  const db = freshDb();
  const fuel = tx(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: P(4000), fuel: { litres_milli: 40000, station: 'HP' } });
  const other = tx(db, { type: 'expense', category_key: 'necessary.groceries', date: '2026-02-04', amount_paise: P(100), fuel: { litres_milli: 5, station: 'x' } });
  assert.equal(fuel.litres_milli, 40000);
  assert.equal(fuel.station, 'HP');
  assert.equal(other.litres_milli, null);
});

test('uuid() produces unique, well-formed v4 ids and the zod-style uuid check accepts them', async () => {
  const { uuid } = await import('../src/utils/uuid.js');
  const ids = new Set(Array.from({ length: 500 }, () => uuid()));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
