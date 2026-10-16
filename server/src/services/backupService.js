// Versioned JSON backup / restore / reset. Pure (takes a db handle) so it runs in Node and in the browser.
// Backups contain your financial data in plain JSON — treat the file like a bank statement.
import { badRequest } from '../utils/errors.js';
import { nowIso } from '../utils/dates.js';

export const BACKUP_APP = 'flowmoney';
export const BACKUP_VERSION = 1;

// Parent tables first (restore order). Deleting happens in reverse.
export const DATA_TABLES = [
  'profile', 'salary_history', 'categories', 'vehicles', 'loans', 'savings_accounts', 'savings_goals', 'import_batches',
  'transactions', 'fuel_details', 'loan_payments', 'budgets', 'recurring_rules', 'app_settings',
];

const columnsOf = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const knownMigrations = (db) => db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r) => r.version);

export function exportBackup(db) {
  const tables = {};
  for (const t of DATA_TABLES) {
    // categories: parents before children so they can be re-inserted in order
    const order = t === 'categories' ? 'ORDER BY parent_id IS NOT NULL, id' : '';
    tables[t] = db.prepare(`SELECT * FROM ${t} ${order}`).all();
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exported_at: nowIso(), migrations: knownMigrations(db), tables };
}

export function countsOf(db) {
  const out = {};
  for (const t of ['transactions', 'loans', 'salary_history', 'savings_accounts', 'savings_goals']) {
    out[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  }
  return out;
}

/** Throws a user-readable error unless `data` is a backup this version can restore. Never touches the database. */
export function validateBackup(db, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw badRequest('This file is not a FlowMoney backup.');
  if (data.app !== BACKUP_APP) throw badRequest('This file is not a FlowMoney backup.');
  if (!Number.isInteger(data.version) || data.version < 1) throw badRequest('Backup has no valid version.');
  if (data.version > BACKUP_VERSION) throw badRequest('This backup was made by a newer FlowMoney. Update the app and try again.');
  if (!data.tables || typeof data.tables !== 'object') throw badRequest('Backup is missing its data.');
  const known = new Set(knownMigrations(db));
  for (const m of data.migrations || []) if (!known.has(m)) throw badRequest('Backup uses a database layout this app does not know.');
  for (const t of DATA_TABLES) {
    const rows = data.tables[t];
    if (!Array.isArray(rows)) throw badRequest(`Backup is missing the "${t}" table.`);
    const cols = new Set(columnsOf(db, t));
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw badRequest(`Backup has a malformed row in "${t}".`);
      for (const [k, v] of Object.entries(row)) {
        if (!cols.has(k)) throw badRequest(`Backup has an unknown field "${k}" in "${t}".`);
        if (v !== null && !['string', 'number'].includes(typeof v)) throw badRequest(`Backup has an invalid value in "${t}.${k}".`);
        if (typeof v === 'number' && !Number.isFinite(v)) throw badRequest(`Backup has an invalid number in "${t}.${k}".`);
      }
    }
  }
  const tx = data.tables.transactions;
  for (const r of tx) {
    if (!Number.isInteger(r.amount_paise) || r.amount_paise <= 0) throw badRequest('Backup contains a transaction with an invalid amount.');
  }
  return {
    exported_at: data.exported_at || null,
    incoming: {
      transactions: tx.length, loans: data.tables.loans.length, salary_history: data.tables.salary_history.length,
      savings_accounts: data.tables.savings_accounts.length, savings_goals: data.tables.savings_goals.length,
    },
    current: countsOf(db),
  };
}

function clearAll(db) {
  for (const t of [...DATA_TABLES].reverse()) {
    if (t === 'categories') { db.prepare('DELETE FROM categories WHERE parent_id IS NOT NULL').run(); }
    db.prepare(`DELETE FROM ${t}`).run();
  }
}

/** Replaces ALL current data with the backup, atomically. If anything fails nothing changes. */
export function restoreBackup(db, data) {
  const summary = validateBackup(db, data);
  db.transaction(() => {
    clearAll(db);
    for (const t of DATA_TABLES) {
      const cols = columnsOf(db, t);
      const rows = t === 'categories' ? [...data.tables[t]].sort((a, b) => (a.parent_id != null) - (b.parent_id != null)) : data.tables[t];
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (!keys.length) continue;
        db.prepare(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => row[k]));
      }
    }
    // Foreign keys are enforced per statement; make sure the restored set is consistent before committing.
    const bad = db.prepare('PRAGMA foreign_key_check').all();
    if (bad.length) throw badRequest('Backup data is inconsistent (broken links between records). Nothing was changed.');
  })();
  return summary;
}

/** Deletes every record and restores factory defaults (system categories, default settings). */
export function resetAll(db) {
  db.transaction(() => {
    clearAll(db);
    const ts = nowIso();
    const cat = db.prepare('INSERT INTO categories (key,name,group_key,parent_id,sort_order,is_system) VALUES (?,?,?,?,?,?)');
    const root = {};
    const roots = [['loan', 'Loan / EMI', 1], ['saving', 'Saving', 2], ['necessary', 'Necessary expenses', 3], ['misc', 'Misc', 4], ['income', 'Income', 5], ['transfer', 'Transfer', 6]];
    for (const [key, name, order] of roots) root[key] = cat.run(key, name, key, null, order, 1).lastInsertRowid;
    const subs = {
      necessary: [['fuel', 'Fuel / commute'], ['groceries', 'Groceries'], ['utilities', 'Utilities'], ['internet', 'Internet & mobile'], ['medical', 'Medical'], ['rent', 'Rent'], ['insurance', 'Insurance'], ['household', 'Household']],
      misc: [['dining', 'Food & dining'], ['shopping', 'Shopping'], ['entertainment', 'Entertainment'], ['travel', 'Travel'], ['subscriptions', 'Subscriptions'], ['other', 'Other']],
    };
    for (const [g, list] of Object.entries(subs)) list.forEach(([k, n], i) => cat.run(`${g}.${k}`, n, g, root[g], i + 1, 0));
    db.prepare('INSERT INTO profile (id, created_at, updated_at) VALUES (1, ?, ?)').run(ts, ts);
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('spent_includes_loans', '1')").run();
  })();
  return { reset: true };
}
