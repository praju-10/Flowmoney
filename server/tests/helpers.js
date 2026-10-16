import { createDb } from '../src/database/db.js';
export const freshDb = () => createDb(':memory:');
export const P = (rupees) => Math.round(rupees * 100);
