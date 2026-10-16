import { AppError, badRequest, notFound } from '../utils/errors.js';
import { uuid } from '../utils/uuid.js';
import { nowIso } from '../utils/dates.js';
import { runningRemaining } from './financeService.js';

// Which category groups are legal for each transaction type.
const ALLOWED_GROUPS = {
  income: ['income'],
  expense: ['necessary', 'misc', 'loan'],
  saving: ['saving'],
  loan_payment: ['loan'],
  transfer: ['transfer'],
  refund: ['necessary', 'misc', 'loan'],
};
const DEFAULT_CATEGORY = { income: 'income', expense: 'misc', saving: 'saving', loan_payment: 'loan', transfer: 'transfer', refund: 'misc' };

export function resolveCategory(db, input) {
  const row = input.category_id
    ? db.prepare('SELECT * FROM categories WHERE id = ?').get(input.category_id)
    : db.prepare('SELECT * FROM categories WHERE key = ?').get(input.category_key || DEFAULT_CATEGORY[input.type]);
  if (!row) throw badRequest('Unknown category');
  if (!ALLOWED_GROUPS[input.type].includes(row.group_key)) {
    throw badRequest(`A "${input.type}" transaction cannot be filed under "${row.name}"`);
  }
  return row;
}

const COLS = `SELECT t.*, c.name AS category_name, c.key AS category_key, c.group_key,
         p.litres_milli, p.price_per_litre_paise, p.odometer_km, p.station,
         lp.period AS loan_period, lp.kind AS loan_payment_kind`;
const JOINS = `FROM transactions t
  JOIN categories c ON c.id = t.category_id
  LEFT JOIN fuel_details p ON p.transaction_id = t.id
  LEFT JOIN loan_payments lp ON lp.transaction_id = t.id`;

export function getTransaction(db, id) {
  const r = db.prepare(`${COLS} ${JOINS} WHERE t.id = ?`).get(id);
  if (!r) throw notFound('Transaction');
  return r;
}

function saveFuel(db, id, fuel) {
  db.prepare('DELETE FROM fuel_details WHERE transaction_id = ?').run(id);
  if (!fuel) return;
  db.prepare(
    'INSERT INTO fuel_details (transaction_id, litres_milli, price_per_litre_paise, odometer_km, station) VALUES (?,?,?,?,?)',
  ).run(id, fuel.litres_milli ?? null, fuel.price_per_litre_paise ?? null, fuel.odometer_km ?? null, fuel.station ?? '');
}

export function createTransaction(db, input, extra = {}) {
  return db.transaction(() => {
    const cat = resolveCategory(db, input);
    const id = uuid();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO transactions (id,date,amount_paise,type,category_id,description,merchant,payment_method,notes,
         loan_id,savings_account_id,goal_id,vehicle_id,refund_of,import_batch_id,source_row,dedupe_key,is_demo,created_at,updated_at)
       VALUES (@id,@date,@amount_paise,@type,@category_id,@description,@merchant,@payment_method,@notes,
         @loan_id,@savings_account_id,@goal_id,@vehicle_id,@refund_of,@import_batch_id,@source_row,@dedupe_key,@is_demo,@ts,@ts)`,
    ).run({
      id, ts,
      date: input.date,
      amount_paise: input.amount_paise,
      type: input.type,
      category_id: cat.id,
      description: input.description ?? '',
      merchant: input.merchant ?? '',
      payment_method: input.payment_method ?? '',
      notes: input.notes ?? '',
      loan_id: extra.loan_id ?? input.loan_id ?? null,
      savings_account_id: input.savings_account_id ?? null,
      goal_id: input.goal_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      refund_of: input.refund_of ?? null,
      import_batch_id: extra.import_batch_id ?? null,
      source_row: extra.source_row ?? null,
      dedupe_key: extra.dedupe_key ?? null,
      is_demo: extra.is_demo ? 1 : 0,
    });
    if (input.fuel && cat.key === 'necessary.fuel') saveFuel(db, id, input.fuel);
    return getTransaction(db, id);
  })();
}

export function updateTransaction(db, id, input) {
  return db.transaction(() => {
    const existing = getTransaction(db, id);
    if (existing.loan_payment_kind) {
      throw new AppError(409, 'Loan payments are edited from the loan: delete the payment and record it again.', 'LOAN_PAYMENT_LOCKED');
    }
    const cat = resolveCategory(db, input);
    db.prepare(
      `UPDATE transactions SET date=?, amount_paise=?, type=?, category_id=?, description=?, merchant=?, payment_method=?,
         notes=?, savings_account_id=?, goal_id=?, vehicle_id=?, updated_at=? WHERE id=?`,
    ).run(
      input.date, input.amount_paise, input.type, cat.id, input.description ?? '', input.merchant ?? '',
      input.payment_method ?? '', input.notes ?? '', input.savings_account_id ?? null, input.goal_id ?? null,
      input.vehicle_id ?? null, nowIso(), id,
    );
    saveFuel(db, id, cat.key === 'necessary.fuel' ? input.fuel : null);
    return getTransaction(db, id);
  })();
}

export function deleteTransaction(db, id) {
  return db.transaction(() => {
    const existing = getTransaction(db, id);
    // Correction workflow: deleting a loan payment restores any principal it had reduced.
    const lp = db.prepare('SELECT * FROM loan_payments WHERE transaction_id = ?').get(id);
    if (lp) {
      const restore = lp.principal_paise ?? (lp.kind === 'prepayment' ? existing.amount_paise : 0);
      if (restore) {
        db.prepare('UPDATE loans SET outstanding_paise = outstanding_paise + ?, updated_at = ? WHERE id = ? AND outstanding_paise IS NOT NULL')
          .run(restore, nowIso(), lp.loan_id);
      }
    }
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return { deleted: id };
  })();
}

/** Filtered, paginated list. All filters are bound parameters (no string concatenation of user input). */
export function listTransactions(db, q) {
  const where = [];
  const p = {};
  if (q.month) { where.push('t.date >= @ms AND t.date < @me'); p.ms = `${q.month}-01`; p.me = nextMonth(q.month); }
  if (q.year) { where.push('t.date >= @ys AND t.date < @ye'); p.ys = `${q.year}-01-01`; p.ye = `${q.year + 1}-01-01`; }
  if (q.from) { where.push('t.date >= @from'); p.from = q.from; }
  if (q.to) { where.push('t.date <= @to'); p.to = q.to; }
  if (q.type) { where.push('t.type = @type'); p.type = q.type; }
  if (q.group) { where.push('c.group_key = @group'); p.group = q.group; }
  if (q.category_id) { where.push('t.category_id = @cid'); p.cid = q.category_id; }
  if (q.min_paise != null) { where.push('t.amount_paise >= @min'); p.min = q.min_paise; }
  if (q.max_paise != null) { where.push('t.amount_paise <= @max'); p.max = q.max_paise; }
  if (q.search) {
    where.push("(t.description LIKE @s ESCAPE '\\' OR t.merchant LIKE @s ESCAPE '\\')");
    p.s = `%${q.search.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = q.sort === 'amount' ? 't.amount_paise' : 't.date';
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const total = db.prepare(`SELECT COUNT(*) AS n ${JOINS} ${w}`).get(p).n;
  const items = db
    .prepare(`${COLS} ${JOINS} ${w} ORDER BY ${sortCol} ${dir}, t.created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...p, limit: q.limit, offset: (q.page - 1) * q.limit });
  if (q.month) {
    const left = runningRemaining(db, q.month);
    for (const t of items) t.remaining_after_paise = left.get(t.id) ?? null;
  }
  return { items, total, page: q.page, limit: q.limit };
}

export function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
