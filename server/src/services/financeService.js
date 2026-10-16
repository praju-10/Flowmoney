// Central financial calculation service. The ONLY place totals are computed.
//
// Rules (also shown to the user in the UI as "How are these calculated?"):
//  - income        : money received (salary is tracked separately in salary_history)
//  - expense       : spending, counted in its category group (loan / necessary / misc)
//  - loan_payment  : EMI or prepayment; counted ONCE, in the Loan / EMI group
//  - saving        : contribution to savings/investments; counted ONCE, in the Saving group
//  - refund        : reduces its category group's total (never below zero)
//  - transfer      : excluded from every total
// "Spent"     = Loan + Necessary + Misc by default (setting spent_includes_loans = 1). Savings are never "spent".
// "Remaining" = income − (Loan + Saving + Necessary + Misc). It can be negative (overspent) and is shown as such.
import { monthBounds, currentMonth } from '../utils/dates.js';
import { pct } from '../utils/money.js';

export const GROUPS = ['loan', 'saving', 'necessary', 'misc'];

export function getSetting(db, key, fallback = null) {
  const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}

/** Salary effective for a month: latest salary_history row starting before the month ends. */
export function salaryForMonth(db, month) {
  const { end } = monthBounds(month);
  const r = db
    .prepare('SELECT amount_paise FROM salary_history WHERE effective_from < ? ORDER BY effective_from DESC LIMIT 1')
    .get(end);
  return r ? r.amount_paise : 0;
}

/** 'final' once the month's last date has passed, 'in_progress' for the current month, 'upcoming' for future months. */
export function monthStatus(month, now = new Date()) {
  const cur = currentMonth(now);
  return month < cur ? 'final' : month === cur ? 'in_progress' : 'upcoming';
}

export function groupTotals(db, month) {
  const { start, end } = monthBounds(month);
  const rows = db
    .prepare(
      `SELECT c.group_key AS g, t.type AS type, SUM(t.amount_paise) AS s, COUNT(*) AS n
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.date >= ? AND t.date < ? GROUP BY c.group_key, t.type`,
    )
    .all(start, end);
  const groups = { loan: 0, saving: 0, necessary: 0, misc: 0 };
  const counts = { loan: 0, saving: 0, necessary: 0, misc: 0 };
  let extraIncome = 0;
  for (const r of rows) {
    if (r.type === 'income') { extraIncome += r.s; continue; }
    if (r.type === 'transfer' || !(r.g in groups)) continue;
    groups[r.g] += r.type === 'refund' ? -r.s : r.s;
    counts[r.g] += r.n;
  }
  for (const g of GROUPS) if (groups[g] < 0) groups[g] = 0; // refunds can't make a group negative
  return { groups, counts, extraIncome };
}

export function monthSummary(db, month, now = new Date()) {
  const { groups, counts, extraIncome } = groupTotals(db, month);
  const salary = salaryForMonth(db, month);
  const income = salary + extraIncome;
  const includeLoans = getSetting(db, 'spent_includes_loans', '1') === '1';
  const spent = groups.necessary + groups.misc + (includeLoans ? groups.loan : 0);
  const saved = groups.saving;
  const remaining = income - groups.loan - groups.saving - groups.necessary - groups.misc;
  return {
    month,
    month_status: monthStatus(month, now),
    salary_paise: salary,
    extra_income_paise: extraIncome,
    income_paise: income,
    spent_paise: spent,
    saved_paise: saved,
    remaining_paise: remaining,
    spent_pct: pct(spent, income),
    saved_pct: pct(saved, income),
    remaining_pct: income > 0 ? Math.round((remaining / income) * 1000) / 10 : 0,
    spent_includes_loans: includeLoans,
    calculation_note: (includeLoans
      ? 'Spent = Loan/EMI + Necessary + Misc, net of refunds.'
      : 'Spent = Necessary + Misc, net of refunds. Loan repayments are shown separately.') +
      ' Remaining = salary and other income, minus Loan/EMI, Saving, Necessary and Misc. Transfers are never counted.',
    groups: Object.fromEntries(
      GROUPS.map((g) => [g, { total_paise: groups[g], pct_of_income: pct(groups[g], income), count: counts[g] }]),
    ),
  };
}

/**
 * Balance left after each entry in a month, in the order entries happened (date, then the order they were added).
 * Starts from the month's salary; income and refunds add to it; expenses, savings and loan payments subtract; transfers are ignored.
 * Returns Map(transactionId -> remaining paise). May be negative.
 */
export function runningRemaining(db, month) {
  const { start, end } = monthBounds(month);
  const rows = db
    .prepare('SELECT t.id, t.type, t.amount_paise FROM transactions t WHERE t.date >= ? AND t.date < ? ORDER BY t.date ASC, t.created_at ASC, t.rowid ASC')
    .all(start, end);
  let balance = salaryForMonth(db, month);
  const out = new Map();
  for (const r of rows) {
    if (r.type === 'income' || r.type === 'refund') balance += r.amount_paise;
    else if (r.type !== 'transfer') balance -= r.amount_paise;
    out.set(r.id, balance);
  }
  return out;
}

/**
 * 12 months × 4 groups for a calendar year. A month with no transactions in a group is `null` (no data), not 0.
 * `completed[i]` is true once that month's last date has passed — only then is the month's sum a final figure.
 */
export function yearHeatmap(db, year, now = new Date()) {
  const rows = db
    .prepare(
      `SELECT substr(t.date,1,7) AS m, c.group_key AS g, t.type AS type, SUM(t.amount_paise) AS s
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.date >= ? AND t.date < ? AND t.type NOT IN ('income','transfer')
       GROUP BY m, g, t.type`,
    )
    .all(`${year}-01-01`, `${year + 1}-01-01`);
  const grid = Object.fromEntries(GROUPS.map((g) => [g, Array(12).fill(null)]));
  for (const r of rows) {
    if (!(r.g in grid)) continue;
    const i = Number(r.m.slice(5)) - 1;
    grid[r.g][i] = (grid[r.g][i] ?? 0) + (r.type === 'refund' ? -r.s : r.s);
  }
  for (const g of GROUPS) grid[g] = grid[g].map((v) => (v === null ? null : Math.max(0, v)));
  const completed = Array.from({ length: 12 }, (_, i) => monthStatus(`${year}-${String(i + 1).padStart(2, '0')}`, now) === 'final');
  return { year, groups: grid, completed };
}

/** Which years have any transactions (for the year switcher). */
export function yearsWithData(db, fallbackYear) {
  const ys = db.prepare('SELECT DISTINCT substr(date,1,4) AS y FROM transactions ORDER BY y DESC').all().map((r) => Number(r.y));
  if (!ys.includes(fallbackYear)) ys.unshift(fallbackYear);
  return ys.sort((a, b) => b - a);
}
