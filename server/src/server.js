import { createDb } from './database/db.js';
import { createApp } from './app.js';
import { config, dbFile } from './config.js';

const db = createDb(dbFile());
const app = createApp(db);
const server = app.listen(config.port, config.host, () => {
  console.log(`FlowMoney API listening on http://${config.host}:${config.port}  (local only)`);
  console.log(`Database: ${dbFile()}`);
});

function shutdown() {
  server.close(() => { try { db.close(); } finally { process.exit(0); } });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
