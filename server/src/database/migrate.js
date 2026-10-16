// Runs versioned SQL migrations. Pure: the caller supplies [{ name, sql }] so this works in Node and in the browser.
export function runMigrations(db, files) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  for (const { name, sql } of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (applied.has(name)) continue;
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
    })();
  }
}
