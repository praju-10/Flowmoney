import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, P } from './helpers.js';
import { exportBackup, restoreBackup, validateBackup, resetAll } from '../src/services/backupService.js';
import { monthSummary, yearHeatmap } from '../src/services/financeService.js';
import { createTransaction } from '../src/services/transactionService.js';
import { createLoan, recordLoanPayment } from '../src/services/loanService.js';
import { setSalary } from '../src/services/profileService.js';
import { loadDemo } from '../src/seed/demo.js';

function seeded() {
  const db = freshDb();
  setSalary(db, { amount_paise: P(100000), effective_from: '2026-01-01' });
  db.prepare("UPDATE profile SET display_name='Priyanka', occupation='Engineer', savings_goal_paise=? WHERE id=1").run(P(50000));
  createTransaction(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-02-03', amount_paise: P(4000), fuel: { litres_milli: 40000, station: 'HP' } });
  createTransaction(db, { type: 'saving', date: '2026-02-05', amount_paise: P(10000) });
  const loan = createLoan(db, { name: 'Home', lender: 'Bank', kind: 'home', original_principal_paise: P(1000000), outstanding_paise: P(500000), interest_rate_bps: 850, emi_paise: P(15000), due_day: 5, start_date: null, end_date: null, tenure_months: null, notes: '' });
  recordLoanPayment(db, loan.id, { kind: 'emi', date: '2026-02-05', amount_paise: P(15000), principal_paise: P(9000), interest_paise: P(6000) });
  return db;
}

test('backup round-trip: restoring into a fresh database reproduces every total, the heatmap and the loan state', () => {
  const a = seeded();
  const json = JSON.parse(JSON.stringify(exportBackup(a))); // through JSON, as a file would be
  const b = freshDb();
  const summary = restoreBackup(b, json);
  assert.equal(summary.incoming.transactions, 3);
  assert.deepEqual(monthSummary(b, '2026-02'), monthSummary(a, '2026-02'));
  assert.deepEqual(yearHeatmap(b, 2026), yearHeatmap(a, 2026));
  assert.equal(b.prepare('SELECT display_name FROM profile').get().display_name, 'Priyanka');
  assert.equal(b.prepare('SELECT outstanding_paise FROM loans').get().outstanding_paise, P(491000));
  assert.equal(b.prepare('SELECT litres_milli FROM fuel_details').get().litres_milli, 40000);
  // the duplicate-EMI guard still works after restoring
  assert.throws(() => recordLoanPayment(b, 1, { kind: 'emi', date: '2026-02-20', amount_paise: P(15000) }), /already recorded/);
});

test('restore REPLACES existing data (and reports what it replaced)', () => {
  const src = seeded();
  const dst = freshDb();
  createTransaction(dst, { type: 'expense', category_key: 'misc.other', date: '2026-05-01', amount_paise: 100 });
  const summary = restoreBackup(dst, exportBackup(src));
  assert.equal(summary.current.transactions, 1);
  assert.equal(summary.incoming.transactions, 3);
  assert.equal(dst.prepare('SELECT COUNT(*) n FROM transactions').get().n, 3);
});

test('invalid backups are rejected before anything is changed', () => {
  const db = seeded();
  const good = exportBackup(db);
  const before = JSON.stringify(exportBackup(db).tables);
  const bad = [
    null, 'text', [], {}, { app: 'other', version: 1, tables: {} },
    { ...good, version: 99 }, { ...good, version: 0 }, { ...good, tables: undefined },
    { ...good, migrations: ['999_future.sql'] },
    { ...good, tables: { ...good.tables, transactions: undefined } },
    { ...good, tables: { ...good.tables, transactions: [{ id: 'x', evil_column: 1 }] } },
    { ...good, tables: { ...good.tables, transactions: [{ ...good.tables.transactions[0], amount_paise: -5 }] } },
    { ...good, tables: { ...good.tables, transactions: [{ ...good.tables.transactions[0], amount_paise: 1.5 }] } },
    { ...good, tables: { ...good.tables, transactions: [{ ...good.tables.transactions[0], description: { a: 1 } }] } },
  ];
  for (const b of bad) assert.throws(() => restoreBackup(db, b), (e) => e.status === 400);
  assert.equal(JSON.stringify(exportBackup(db).tables), before);
});

test('a backup with broken links rolls back completely', () => {
  const db = seeded();
  const good = exportBackup(db);
  const before = JSON.stringify(exportBackup(db).tables);
  const broken = JSON.parse(JSON.stringify(good));
  broken.tables.transactions[0].category_id = 9999; // no such category
  assert.throws(() => restoreBackup(db, broken));
  assert.equal(JSON.stringify(exportBackup(db).tables), before);
});

test('validateBackup previews counts without modifying data', () => {
  const db = seeded();
  const other = exportBackup(freshDb());
  const p = validateBackup(db, other);
  assert.equal(p.incoming.transactions, 0);
  assert.equal(p.current.transactions, 3);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM transactions').get().n, 3);
});

test('resetAll wipes everything and leaves a working empty app', () => {
  const db = seeded();
  loadDemo(db, { year: 2026, upToMonth: 2 });
  resetAll(db);
  for (const t of ['transactions', 'loans', 'salary_history', 'loan_payments', 'fuel_details']) {
    assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n, 0);
  }
  assert.equal(db.prepare('SELECT display_name FROM profile').get().display_name, '');
  assert.equal(monthSummary(db, '2026-02').spent_paise, 0);
  // still usable: categories are back, and new data can be added
  createTransaction(db, { type: 'expense', category_key: 'necessary.fuel', date: '2026-03-01', amount_paise: 500 });
  assert.equal(monthSummary(db, '2026-03').groups.necessary.total_paise, 500);
});
