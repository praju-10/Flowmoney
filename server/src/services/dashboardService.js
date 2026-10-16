import { monthSummary, yearHeatmap, yearsWithData, runningRemaining } from './financeService.js';
import { listLoans } from './loanService.js';
import { listTransactions } from './transactionService.js';
import { getProfile } from './profileService.js';
import { monthBounds } from '../utils/dates.js';
import { pct } from '../utils/money.js';

export function dashboard(db, month) {
  const summary = monthSummary(db, month);
  const profile = getProfile(db, month);
  const { start, end } = monthBounds(month);
  const goal = profile.savings_goal_paise;
  const loans = listLoans(db, month);

  // One query for all four panels, derived from the same transactions the totals come from.
  const txs = listTransactions(db, { month, limit: 500, page: 1, sort: 'date', dir: 'desc' }).items.filter(
    (t) => t.type !== 'income' && t.type !== 'transfer',
  );
  const left = runningRemaining(db, month);
  const byGroup = { loan: [], saving: [], necessary: [], misc: [] };
  for (const t of txs) if (byGroup[t.group_key]) byGroup[t.group_key].push({ ...t, remaining_after_paise: left.get(t.id) ?? null });

  const hasAnyData = db.prepare('SELECT 1 FROM transactions LIMIT 1').get() || db.prepare('SELECT 1 FROM salary_history LIMIT 1').get();
  return {
    month, range: { start, end },
    profile: { display_name: profile.display_name, occupation: profile.occupation, currency: profile.currency },
    summary,
    goal: { target_paise: goal, saved_paise: summary.saved_paise, pct: Math.min(100, pct(summary.saved_paise, goal)) },
    loans,
    transactions: byGroup,
    is_empty: !hasAnyData,
    has_demo: !!(db.prepare('SELECT 1 FROM transactions WHERE is_demo = 1 LIMIT 1').get() || db.prepare('SELECT 1 FROM loans WHERE is_demo = 1 LIMIT 1').get()),
  };
}

export const heatmap = (db, year) => ({ ...yearHeatmap(db, year), years: yearsWithData(db, year) });
