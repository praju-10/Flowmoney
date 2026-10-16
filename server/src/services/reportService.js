// Report aggregates. Everything is derived from monthSummary()/transactions, so reports can never disagree with the dashboard.
import { monthSummary, GROUPS, monthStatus } from './financeService.js';
import { listLoans } from './loanService.js';
import { monthBounds } from '../utils/dates.js';
import { pct } from '../utils/money.js';

const pad = (n) => String(n).padStart(2, '0');

/** One row per month of the year, plus year totals. Months without any data are flagged so charts don't invent numbers. */
export function yearReport(db, year, now = new Date()) {
  const months = [];
  for (let i = 1; i <= 12; i++) {
    const m = `${year}-${pad(i)}`;
    const s = monthSummary(db, m, now);
    const { start, end } = monthBounds(m);
    const txCount = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE date >= ? AND date < ?').get(start, end).n;
    months.push({
      month: m,
      status: s.month_status, // final | in_progress | upcoming — a month's sums are final once its last date has passed
      has_data: txCount > 0 || s.salary_paise > 0,
      income_paise: s.income_paise,
      loan_paise: s.groups.loan.total_paise,
      saving_paise: s.groups.saving.total_paise,
      necessary_paise: s.groups.necessary.total_paise,
      misc_paise: s.groups.misc.total_paise,
      spent_paise: s.spent_paise,
      remaining_paise: s.remaining_paise,
    });
  }
  const counted = months.filter((m) => m.has_data && m.status !== 'upcoming');
  const sum = (k) => counted.reduce((a, m) => a + m[k], 0);
  const totals = {
    months_counted: counted.length,
    income_paise: sum('income_paise'), loan_paise: sum('loan_paise'), saving_paise: sum('saving_paise'),
    necessary_paise: sum('necessary_paise'), misc_paise: sum('misc_paise'), spent_paise: sum('spent_paise'), remaining_paise: sum('remaining_paise'),
  };
  totals.avg_monthly_spent_paise = counted.length ? Math.round(totals.spent_paise / counted.length) : null;
  totals.savings_rate_pct = pct(totals.saving_paise, totals.income_paise);
  // Final totals use only months whose last date has passed (in-progress months are excluded until they finish)
  const final = months.filter((m) => m.status === 'final' && m.has_data);
  const fsum = (k) => final.reduce((a, m) => a + m[k], 0);
  const final_totals = {
    months_counted: final.length,
    income_paise: fsum('income_paise'), loan_paise: fsum('loan_paise'), saving_paise: fsum('saving_paise'),
    necessary_paise: fsum('necessary_paise'), misc_paise: fsum('misc_paise'), spent_paise: fsum('spent_paise'), remaining_paise: fsum('remaining_paise'),
  };
  return { year, months, totals, final_totals };
}

/** Per-sub-category breakdown for one month (net of refunds), comparison with the previous month, and a loan snapshot. */
export function monthReport(db, month, now = new Date()) {
  const { start, end } = monthBounds(month);
  const rows = db
    .prepare(
      `SELECT c.group_key AS g, c.name AS name, t.type AS type, SUM(t.amount_paise) AS s
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.date >= ? AND t.date < ? AND t.type NOT IN ('income','transfer')
       GROUP BY c.group_key, c.name, t.type`,
    ).all(start, end);
  const bucket = new Map();
  for (const r of rows) {
    const k = `${r.g}|${r.name}`;
    bucket.set(k, { group: r.g, name: r.name, total_paise: (bucket.get(k)?.total_paise || 0) + (r.type === 'refund' ? -r.s : r.s) });
  }
  const subcategories = [...bucket.values()].filter((x) => x.total_paise > 0).sort((a, b) => b.total_paise - a.total_paise);

  const [y, m] = month.split('-').map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const cur = monthSummary(db, month, now);
  const prev = monthSummary(db, prevMonth, now);
  const comparison = GROUPS.map((g) => ({
    group: g,
    current_paise: cur.groups[g].total_paise,
    previous_paise: prev.groups[g].total_paise,
    change_pct: prev.groups[g].total_paise > 0 ? Math.round(((cur.groups[g].total_paise - prev.groups[g].total_paise) / prev.groups[g].total_paise) * 1000) / 10 : null,
  }));
  const loans = listLoans(db, month).map((l) => ({
    id: l.id, name: l.name, lender: l.lender, emi_paise: l.emi_paise, outstanding_paise: l.outstanding_paise,
    total_paid_paise: l.total_paid_paise, status: l.status, progress_pct: l.progress_pct,
  }));
  return {
    month, month_status: monthStatus(month, now), previous_month: prevMonth,
    summary: { income_paise: cur.income_paise, spent_paise: cur.spent_paise, saved_paise: cur.saved_paise, remaining_paise: cur.remaining_paise },
    subcategories, comparison, loans,
  };
}
