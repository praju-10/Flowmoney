import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute } from '../middleware/errorHandler.js';
import * as S from '../validators/schemas.js';
import { currentMonth } from '../utils/dates.js';
import { dashboard, heatmap } from '../services/dashboardService.js';
import { createTransaction, updateTransaction, deleteTransaction, getTransaction, listTransactions } from '../services/transactionService.js';
import { createLoan, updateLoan, deleteLoan, listLoans, recordLoanPayment, loanPaymentHistory } from '../services/loanService.js';
import { getProfile, updateProfile, setSalary } from '../services/profileService.js';
import { yearReport, monthReport } from '../services/reportService.js';
import { loadDemo, clearDemo } from '../seed/demo.js';
import { dbFile } from '../config.js';

const id = (req) => z.coerce.number().int().positive().parse(req.params.id);

export function buildRouter(db) {
  const r = Router();

  r.get('/health', (req, res) => res.json({ ok: true }));

  // ---- Dashboard
  r.get('/dashboard', asyncRoute((req, res) => {
    const m = S.month.default(currentMonth()).parse(req.query.month);
    res.json(dashboard(db, m));
  }));
  r.get('/dashboard/heatmap', asyncRoute((req, res) => {
    const y = z.coerce.number().int().min(1990).max(2200).default(new Date().getFullYear()).parse(req.query.year);
    res.json(heatmap(db, y));
  }));

  // ---- Reports
  r.get('/reports/year', asyncRoute((req, res) => {
    const y = z.coerce.number().int().min(1990).max(2200).default(new Date().getFullYear()).parse(req.query.year);
    res.json(yearReport(db, y));
  }));
  r.get('/reports/month', asyncRoute((req, res) => res.json(monthReport(db, S.month.default(currentMonth()).parse(req.query.month)))));

  // ---- Profile & salary
  r.get('/profile', asyncRoute((req, res) => res.json(getProfile(db, S.month.default(currentMonth()).parse(req.query.month)))));
  r.put('/profile', asyncRoute((req, res) => res.json(updateProfile(db, S.profileInput.parse(req.body)))));
  r.post('/salary', asyncRoute((req, res) => res.status(201).json(setSalary(db, S.salaryInput.parse(req.body)))));

  // ---- Categories
  r.get('/categories', asyncRoute((req, res) =>
    res.json(db.prepare('SELECT id,key,name,group_key,parent_id FROM categories WHERE archived = 0 ORDER BY sort_order, name').all())));

  // ---- Transactions
  r.get('/transactions', asyncRoute((req, res) => res.json(listTransactions(db, S.transactionQuery.parse(req.query)))));
  r.get('/transactions/:uuid', asyncRoute((req, res) => res.json(getTransaction(db, z.string().uuid().parse(req.params.uuid)))));
  r.post('/transactions', asyncRoute((req, res) => res.status(201).json(createTransaction(db, S.transactionInput.parse(req.body)))));
  r.put('/transactions/:uuid', asyncRoute((req, res) =>
    res.json(updateTransaction(db, z.string().uuid().parse(req.params.uuid), S.transactionInput.parse(req.body)))));
  r.delete('/transactions/:uuid', asyncRoute((req, res) => res.json(deleteTransaction(db, z.string().uuid().parse(req.params.uuid)))));

  // ---- Loans
  r.get('/loans', asyncRoute((req, res) => res.json(listLoans(db, S.month.default(currentMonth()).parse(req.query.month)))));
  r.post('/loans', asyncRoute((req, res) => res.status(201).json(createLoan(db, S.loanInput.parse(req.body)))));
  r.put('/loans/:id', asyncRoute((req, res) => res.json(updateLoan(db, id(req), S.loanInput.parse(req.body)))));
  r.delete('/loans/:id', asyncRoute((req, res) => res.json(deleteLoan(db, id(req)))));
  r.get('/loans/:id/payments', asyncRoute((req, res) => res.json(loanPaymentHistory(db, id(req)))));
  r.post('/loans/:id/payments', asyncRoute((req, res) =>
    res.status(201).json(recordLoanPayment(db, id(req), S.loanPaymentInput.parse(req.body)))));

  // ---- Local data / demo
  r.get('/settings/storage', asyncRoute((req, res) => res.json({ database_file: dbFile(), note: 'Stored on this computer only.' })));
  r.post('/demo', asyncRoute((req, res) => {
    const now = new Date();
    const { year = now.getFullYear(), month = now.getMonth() + 1 } = S.demoInput.parse(req.body ?? {});
    if (db.prepare('SELECT 1 FROM loans WHERE is_demo = 1').get()) {
      return res.status(409).json({ error: 'Demo data is already loaded.', code: 'CONFLICT' });
    }
    res.status(201).json(loadDemo(db, { year, upToMonth: month }));
  }));
  r.delete('/demo', asyncRoute((req, res) => res.json(clearDemo(db))));

  r.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));
  return r;
}
