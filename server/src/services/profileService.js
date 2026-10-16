import { nowIso, monthBounds, currentMonth } from '../utils/dates.js';
import { salaryForMonth } from './financeService.js';

export function getProfile(db, month = currentMonth()) {
  const p = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const hist = db.prepare('SELECT * FROM salary_history ORDER BY effective_from DESC').all();
  return { ...p, salary_paise: salaryForMonth(db, month), salary_history: hist };
}

export function updateProfile(db, input) {
  db.transaction(() => {
    db.prepare(
      `UPDATE profile SET display_name=@display_name, occupation=@occupation, email=@email, phone=@phone,
         currency=@currency, savings_goal_paise=@savings_goal_paise, updated_at=@ts WHERE id=1`,
    ).run({ ...input, ts: nowIso() });
  })();
  return getProfile(db);
}

/** Adds a salary period. Earlier periods are never rewritten, so history stays correct. */
export function setSalary(db, { amount_paise, effective_from, gross_paise = null, pay_day = null }, { is_demo = false } = {}) {
  db.prepare(
    `INSERT INTO salary_history (effective_from, amount_paise, gross_paise, pay_day, is_demo, created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(effective_from) DO UPDATE SET amount_paise=excluded.amount_paise, gross_paise=excluded.gross_paise, pay_day=excluded.pay_day`,
  ).run(effective_from, amount_paise, gross_paise, pay_day, is_demo ? 1 : 0, nowIso());
  return db.prepare('SELECT * FROM salary_history ORDER BY effective_from DESC').all();
}
