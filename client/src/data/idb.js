// Minimal IndexedDB key/value store used to keep the database file on this device.
const NAME = 'flowmoney';
const STORE = 'kv';
const open = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') return reject(new Error('This browser does not allow local storage (IndexedDB is unavailable).'));
  const r = indexedDB.open(NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error || new Error('Could not open local storage.'));
});
const tx = async (mode, fn) => {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error || new Error('Local storage write failed.'));
      t.onabort = () => reject(t.error || new Error('Local storage write was aborted.'));
    });
  } finally { db.close(); }
};
export const idbGet = (key) => tx('readonly', (s) => s.get(key));
export const idbSet = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const idbDelete = (key) => tx('readwrite', (s) => s.delete(key));
