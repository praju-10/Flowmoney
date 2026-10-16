// The app's database. SQLite (compiled to WebAssembly) runs inside the browser and its file is saved in IndexedDB on THIS device.
// Nothing here makes a network request except loading the bundled .wasm file from the app's own origin.
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { wrapSqlJs } from './sqljsAdapter.js';
import { idbGet, idbSet } from './idb.js';
import { runMigrations } from '../../../server/src/database/migrate.js';

// The same versioned migrations the Node server uses.
const migrationFiles = import.meta.glob('../../../server/src/database/migrations/*.sql', { query: '?raw', import: 'default', eager: true });

const KEY = 'db-v1';
let ready = null;
let handle = null;
let dirty = false;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flowmoney-data') : null;
const TAB = Math.random().toString(36).slice(2);

async function open() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await idbGet(KEY);
  const raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
  const db = wrapSqlJs(raw, { onWrite: () => { dirty = true; } });
  raw.exec('PRAGMA foreign_keys = ON');
  runMigrations(db, Object.entries(migrationFiles).map(([path, sql]) => ({ name: path.split('/').pop(), sql })));
  db.prepare('SELECT COUNT(*) AS n FROM profile').get(); // sanity check: refuse to continue on a corrupt file instead of overwriting it
  handle = db;
  if (!bytes) { dirty = true; await flush(); }
  return db;
}

export const getDb = () => (ready ??= open().catch((e) => { ready = null; throw e; }));

/** Drops the in-memory copy so the next call reloads from storage. */
export function reloadFromStorage() { ready = null; handle = null; dirty = false; }

/** Writes the database to IndexedDB if anything changed. Throws if it could not be saved. */
export async function flush() {
  if (!handle || !dirty) return;
  if (handle.depth() > 0) throw new Error('Cannot save in the middle of a transaction.');
  dirty = false;
  try {
    const bytes = handle.raw.export(); // note: export() reopens the connection, which resets pragmas
    handle.raw.exec('PRAGMA foreign_keys = ON');
    await idbSet(KEY, bytes);
    channel?.postMessage({ from: TAB });
  } catch (e) {
    reloadFromStorage(); // memory and storage must never disagree: discard the unsaved change
    throw e;
  }
}

channel?.addEventListener('message', (m) => {
  if (m.data?.from === TAB) return;
  reloadFromStorage(); // another tab saved: pick up its data on next use
  window.dispatchEvent(new CustomEvent('flowmoney:data-changed'));
});

/** Asks the browser not to evict this data under storage pressure. Installed apps usually get this automatically. */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    const persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    return { supported: true, persisted };
  } catch { return { supported: false, persisted: false }; }
}
export async function storageUsage() {
  try { const e = await navigator.storage?.estimate?.(); return e ? { usage: e.usage, quota: e.quota } : null; } catch { return null; }
}
