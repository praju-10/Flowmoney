// Wraps a sql.js Database in the small subset of the better-sqlite3 API that the shared services use
// (prepare().run/get/all, exec, pragma, transaction). That lets the exact same finance code run in the browser.
const READ_ONLY = /^\s*(select|pragma|with\s[\s\S]*?\bselect)\b/i;
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

function toBind(args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    // sql.js wants the prefix on named parameters; the services use @name
    return Object.fromEntries(Object.entries(args[0]).map(([k, v]) => [/^[@:$]/.test(k) ? k : `@${k}`, norm(v)]));
  }
  return args.flat().map(norm);
}

export function wrapSqlJs(raw, { onWrite }) {
  let depth = 0;
  // A fresh sql.js statement per call, freed immediately: export() invalidates live statements, so none are ever cached.
  const withStmt = (sql, args, fn) => {
    const st = raw.prepare(sql);
    try {
      if (args.length) st.bind(toBind(args));
      return fn(st);
    } finally { st.free(); }
  };
  const touch = (sql) => { if (!READ_ONLY.test(sql)) onWrite(); };
  return {
    raw,
    depth: () => depth,
    exec(sql) { touch(sql); raw.exec(sql); },
    pragma(s) { raw.exec(`PRAGMA ${s}`); },
    prepare(sql) {
      return {
        run: (...a) => {
          withStmt(sql, a, (st) => { st.step(); });
          const changes = raw.getRowsModified();
          const lastInsertRowid = raw.exec('SELECT last_insert_rowid()')[0].values[0][0];
          touch(sql);
          return { changes, lastInsertRowid };
        },
        get: (...a) => withStmt(sql, a, (st) => (st.step() ? st.getAsObject() : undefined)),
        all: (...a) => withStmt(sql, a, (st) => { const out = []; while (st.step()) out.push(st.getAsObject()); return out; }),
      };
    },
    // Nested calls become savepoints, matching better-sqlite3 behaviour.
    transaction(fn) {
      return (...args) => {
        const top = depth === 0;
        const name = `sp${depth}`;
        raw.exec(top ? 'BEGIN' : `SAVEPOINT ${name}`);
        depth += 1;
        try {
          const r = fn(...args);
          depth -= 1;
          raw.exec(top ? 'COMMIT' : `RELEASE ${name}`);
          return r;
        } catch (e) {
          depth -= 1;
          raw.exec(top ? 'ROLLBACK' : `ROLLBACK TO ${name}`);
          if (!top) raw.exec(`RELEASE ${name}`);
          throw e;
        }
      };
    },
  };
}
