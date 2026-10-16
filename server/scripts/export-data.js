// Exports your existing desktop database to a JSON backup you can import on your phone / the hosted app.
//   npm run export-data            (from the project root)
import fs from 'node:fs';
import path from 'node:path';
import { createDb } from '../src/database/db.js';
import { dbFile } from '../src/config.js';
import { exportBackup } from '../src/services/backupService.js';

const file = dbFile();
if (!fs.existsSync(file)) {
  console.error(`No database found at ${file}. Nothing to export.`);
  process.exit(1);
}
const db = createDb(file);
const backup = exportBackup(db);
db.close();
const out = path.resolve(process.cwd(), `flowmoney-backup-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(out, JSON.stringify(backup));
console.log(`Backup written to ${out}`);
console.log(`Transactions: ${backup.tables.transactions.length}, loans: ${backup.tables.loans.length}`);
console.log('This file contains your financial data in plain text. Keep it private.');
