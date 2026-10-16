import { AppError, badRequest, conflict, notFound } from '../utils/errors.js';
import { monthBounds, nowIso, currentMonth, monthOf } from '../utils/dates.js';
import { createTransaction } from './transactionService.js';

export function getLoan(db, id) {
  const l = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  if (!l) throw notFound('Loan');
  return l;
}

/** Status of a loan's EMI for a month: paid | overdue | pending (pending = not yet due or no due day set). */
export function emiStatus(db, loan, month, today = new Date()) {
  const paid = db.prepare("SELECT 1 FROM loan_payments WHERE loan_id = ? AND kind = 'emi' AND period = ?").get(loan.id, month);
  if (paid) return 'paid';
  const cur = currentMonth(today);
  if (month < cur) return 'overdue';
  if (month === cur && loan.due_day && today.getDate() > loan.due_day) return 'overdue';
  return 'pending';
}

export function listLoans(db, month) {
  const loans = db.prepare('SELECT * FROM loans WHERE archived = 0 ORDER BY due_day IS NULL, due_day, name').all();
  const { start, end } = monthBounds(month);
  return loans.map((l) => {
    const paidThisMonth = db
      .prepare(
        `SELECT COALESCE(SUM(t.amount_paise),0) AS s FROM loan_payments lp JOIN transactions t ON t.id = lp.transaction_id
         WHERE lp.loan_id = ? AND t.date >= ? AND t.date < ?`,
      ).get(l.id, start, end).s;
    const totalPaid = db
      .prepare('SELECT COALESCE(SUM(t.amount_paise),0) AS s FROM loan_payments lp JOIN transactions t ON t.id = lp.transaction_id WHERE lp.loan_id = ?')
      .get(l.id).s;
    const progress_pct =
      l.original_principal_paise && l.outstanding_paise != null && l.original_principal_paise > 0
        ? Math.round(((l.original_principal_paise - l.outstanding_paise) / l.original_principal_paise) * 1000) / 10
        : null; // unknown unless both figures were entered
    return { ...l, status: emiStatus(db, l, month), paid_this_month_paise: paidThisMonth, total_paid_paise: totalPaid, progress_pct };
  });
}

export function createLoan(db, input, { is_demo = false } = {}) {
  const ts = nowIso();
  const r = db.prepare(
    `INSERT INTO loans (name,lender,kind,original_principal_paise,outstanding_paise,interest_rate_bps,emi_paise,due_day,
       start_date,end_date,tenure_months,notes,is_demo,created_at,updated_at)
     VALUES (@name,@lender,@kind,@original_principal_paise,@outstanding_paise,@interest_rate_bps,@emi_paise,@due_day,
       @start_date,@end_date,@tenure_months,@notes,@is_demo,@ts,@ts)`,
  ).run({ ...input, is_demo: is_demo ? 1 : 0, ts });
  return getLoan(db, r.lastInsertRowid);
}

export function updateLoan(db, id, input) {
  getLoan(db, id);
  db.prepare(
    `UPDATE loans SET name=@name,lender=@lender,kind=@kind,original_principal_paise=@original_principal_paise,
       outstanding_paise=@outstanding_paise,interest_rate_bps=@interest_rate_bps,emi_paise=@emi_paise,due_day=@due_day,
       start_date=@start_date,end_date=@end_date,tenure_months=@tenure_months,notes=@notes,updated_at=@ts WHERE id=@id`,
  ).run({ ...input, id, ts: nowIso() });
  return getLoan(db, id);
}

export function deleteLoan(db, id) {
  getLoan(db, id);
  // Past payments are historical spending: keep the transactions, detach them from the loan.
  db.transaction(() => {
    db.prepare('DELETE FROM loan_payments WHERE loan_id = ?').run(id);
    db.prepare('DELETE FROM loans WHERE id = ?').run(id);
  })();
  return { deleted: id };
}

/**
 * Records an EMI or prepayment as ONE transaction (type loan_payment) plus a metadata row.
 * - A second EMI for the same loan+period is rejected (409) — delete the wrong one first to correct it.
 * - Outstanding principal only changes when the user supplies the actual principal part (EMI) or for a prepayment.
 *   We never guess the principal/interest split.
 */
export function recordLoanPayment(db, loanId, input, opts = {}) {
  return db.transaction(() => {
    const loan = getLoan(db, loanId);
    const period = input.period || monthOf(input.date);
    if (input.kind === 'emi') {
      const dup = db.prepare("SELECT 1 FROM loan_payments WHERE loan_id = ? AND kind = 'emi' AND period = ?").get(loanId, period);
      if (dup) throw conflict(`An EMI for ${loan.name} is already recorded for ${period}. Delete it first if it was entered incorrectly.`);
    }
    if (input.principal_paise != null && input.interest_paise != null && input.principal_paise + input.interest_paise !== input.amount_paise) {
      throw badRequest('Principal + interest must equal the payment amount');
    }
    const tx = createTransaction(
      db,
      {
        type: 'loan_payment', category_key: 'loan', date: input.date, amount_paise: input.amount_paise,
        description: input.kind === 'prepayment' ? `${loan.name} prepayment` : `${loan.name} EMI`,
        merchant: loan.lender, notes: input.notes ?? '',
      },
      { loan_id: loanId, is_demo: opts.is_demo },
    );
    db.prepare('INSERT INTO loan_payments (loan_id,transaction_id,period,kind,principal_paise,interest_paise) VALUES (?,?,?,?,?,?)')
      .run(loanId, tx.id, period, input.kind, input.principal_paise ?? null, input.interest_paise ?? null);

    const reduce = input.principal_paise ?? (input.kind === 'prepayment' ? input.amount_paise : 0);
    if (reduce && loan.outstanding_paise != null) {
      if (reduce > loan.outstanding_paise) throw badRequest('Payment exceeds the outstanding principal');
      db.prepare('UPDATE loans SET outstanding_paise = outstanding_paise - ?, updated_at = ? WHERE id = ?').run(reduce, nowIso(), loanId);
    }
    return tx;
  })();
}

export function loanPaymentHistory(db, loanId) {
  getLoan(db, loanId);
  return db
    .prepare(
      `SELECT t.id AS transaction_id, t.date, t.amount_paise, lp.period, lp.kind, lp.principal_paise, lp.interest_paise
       FROM loan_payments lp JOIN transactions t ON t.id = lp.transaction_id WHERE lp.loan_id = ? ORDER BY t.date DESC`,
    ).all(loanId);
}
