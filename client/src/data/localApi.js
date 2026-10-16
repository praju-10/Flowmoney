// Same method names the UI always used (src/services/api.js) — but instead of HTTP calls to a server, they run the shared
// validators and finance services directly against the on-device database. Every write is saved to storage before it resolves.
import { z, ZodError } from 'zod';
import { ApiError } from './apiError.js';
import * as S from '../../../server/src/validators/schemas.js';
import { AppError, badRequest, conflict } from '../../../server/src/utils/errors.js';
import { currentMonth } from '../../../server/src/utils/dates.js';
import { dashboard, heatmap } from '../../../server/src/services/dashboardService.js';
import { createTransaction, updateTransaction, deleteTransaction, listTransactions } from '../../../server/src/services/transactionService.js';
import { createLoan, updateLoan, deleteLoan, listLoans, recordLoanPayment, loanPaymentHistory } from '../../../server/src/services/loanService.js';
import { getProfile, updateProfile, setSalary } from '../../../server/src/services/profileService.js';
import { yearReport, monthReport } from '../../../server/src/services/reportService.js';
import { loadDemo, clearDemo } from '../../../server/src/seed/demo.js';
import { exportBackup, validateBackup, restoreBackup, resetAll } from '../../../server/src/services/backupService.js';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const idOf = (v) => z.coerce.number().int().positive().parse(v);
const uuidOf = (v) => z.string().uuid().parse(v);
const yearOf = (v) => z.coerce.number().int().min(1990).max(2200).default(new Date().getFullYear()).parse(v);
const monthOf = (v) => S.month.default(currentMonth()).parse(v || undefined);
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== '' && v != null));

function toApiError(e) {
  if (e instanceof ApiError) return e;
  if (e instanceof ZodError) {
    return new ApiError('Please check the highlighted fields.', 400, Object.fromEntries(e.issues.map((i) => [i.path.join('.') || '_', i.message])));
  }
  if (e instanceof AppError) return new ApiError(e.message, e.status);
  // Log only the error class + message — never records or amounts.
  console.error(`[flowmoney] operation failed: ${e?.name}: ${String(e?.message).slice(0, 200)}`);
  return new ApiError('Something went wrong and your change was NOT saved. Please try again.', 500);
}

function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw badRequest('That file is too large to be a FlowMoney backup.');
  try { return JSON.parse(text); } catch { throw badRequest('That file is not valid JSON, so it cannot be a FlowMoney backup.'); }
}

/** @param {{ getDb: () => Promise<any>, flush: () => Promise<void> }} deps */
export function createLocalApi({ getDb, flush }) {
  const call = (fn) => async (...args) => {
    let db;
    try { db = await getDb(); } catch (e) {
      throw new ApiError(`Could not open the on-device database: ${String(e?.message || e).slice(0, 160)}`, 500);
    }
    let result;
    try { result = fn(db, ...args); } catch (e) { throw toApiError(e); }
    try { await flush(); } catch (e) {
      console.error(`[flowmoney] save failed: ${e?.name}: ${String(e?.message).slice(0, 160)}`);
      throw new ApiError('Your change could NOT be saved on this device (storage may be full or blocked). Nothing was changed.', 500);
    }
    return result;
  };

  return {
    dashboard: call((db, month) => dashboard(db, monthOf(month))),
    heatmap: call((db, year) => heatmap(db, yearOf(year))),
    categories: call((db) => db.prepare('SELECT id,key,name,group_key,parent_id FROM categories WHERE archived = 0 ORDER BY sort_order, name').all()),
    profile: call((db, month) => getProfile(db, monthOf(month))),
    saveProfile: call((db, b) => updateProfile(db, S.profileInput.parse(b))),
    saveSalary: call((db, b) => setSalary(db, S.salaryInput.parse(b))),
    transactions: call((db, q) => listTransactions(db, S.transactionQuery.parse(clean(q)))),
    createTransaction: call((db, b) => createTransaction(db, S.transactionInput.parse(b))),
    updateTransaction: call((db, id, b) => updateTransaction(db, uuidOf(id), S.transactionInput.parse(b))),
    deleteTransaction: call((db, id) => deleteTransaction(db, uuidOf(id))),
    loans: call((db, month) => listLoans(db, monthOf(month))),
    createLoan: call((db, b) => createLoan(db, S.loanInput.parse(b))),
    updateLoan: call((db, id, b) => updateLoan(db, idOf(id), S.loanInput.parse(b))),
    deleteLoan: call((db, id) => deleteLoan(db, idOf(id))),
    loanPayments: call((db, id) => loanPaymentHistory(db, idOf(id))),
    recordPayment: call((db, id, b) => recordLoanPayment(db, idOf(id), S.loanPaymentInput.parse(b))),
    reportYear: call((db, year) => yearReport(db, yearOf(year))),
    reportMonth: call((db, month) => monthReport(db, monthOf(month))),
    loadDemo: call((db) => {
      if (db.prepare('SELECT 1 FROM loans WHERE is_demo = 1').get()) throw conflict('Demo data is already loaded.');
      const now = new Date();
      return loadDemo(db, { year: now.getFullYear(), upToMonth: now.getMonth() + 1 });
    }),
    clearDemo: call((db) => clearDemo(db)),
    exportBackup: call((db) => exportBackup(db)),
    previewBackup: call((db, text) => validateBackup(db, parseBackup(text))),
    restoreBackup: call((db, text) => restoreBackup(db, parseBackup(text))),
    resetAll: call((db) => resetAll(db)),
  };
}
