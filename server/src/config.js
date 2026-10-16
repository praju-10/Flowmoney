import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

export const config = {
  host: process.env.FLOWMONEY_HOST || '127.0.0.1', // loopback only by default
  port: Number(process.env.FLOWMONEY_PORT || 4000),
  dataDir: process.env.FLOWMONEY_DATA_DIR || path.join(repoRoot, 'data'),
  webOrigins: (process.env.FLOWMONEY_WEB_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  clientDist: path.join(repoRoot, 'client', 'dist'),
};
export const dbFile = () => path.join(config.dataDir, 'flowmoney.sqlite');
