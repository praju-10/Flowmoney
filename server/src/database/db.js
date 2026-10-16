import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function migrate(db) {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).map((name) => ({ name, sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8') }));
  runMigrations(db, files);
}

/** Opens (and migrates) a database. Pass ':memory:' in tests. */
export function createDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
