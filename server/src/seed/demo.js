// Demo data. Every row is flagged is_demo=1 so it can be removed without touching real records.
import { createTransaction } from '../services/transactionService.js';
import { createLoan, recordLoanPayment } from '../services/loanService.js';
import { setSalary } from '../services/profileService.js';
import { nowIso } from '../utils/dates.js';

const P = (rupees) => rupees * 100;
const pad = (n) => String(n).padStart(2, '0');

export function loadDemo(db, { year, upToMonth }) {
  return db.transaction(() => {
    const profile = db.prepare('SELECT display_name, savings_goal_paise FROM profile WHERE id = 1').get();
    if (!profile.display_name) {
      db.prepare("UPDATE profile SET display_name='Demo User', occupation='Sample profile (demo)', updated_at=? WHERE id=1").run(nowIso());
    }
    if (!profile.savings_goal_paise) db.prepare('UPDATE profile SET savings_goal_paise=? WHERE id=1').run(P(50000));

    setSalary(db, { amount_paise: P(120000), effective_from: `${year}-01-01` }, { is_demo: true });

    const home = createLoan(db, { name: 'Home Loan', lender: 'HDFC Bank', kind: 'home', original_principal_paise: P(2500000), outstanding_paise: P(2100000), interest_rate_bps: 850, emi_paise: P(15000), due_day: 5, start_date: `${year - 2}-01-05`, end_date: null, tenure_months: null, notes: 'Demo' }, { is_demo: true });
    const car = createLoan(db, { name: 'Car Loan', lender: 'SBI', kind: 'car', original_principal_paise: P(600000), outstanding_paise: P(320000), interest_rate_bps: 900, emi_paise: P(8000), due_day: 10, start_date: null, end_date: null, tenure_months: null, notes: 'Demo' }, { is_demo: true });
    const personal = createLoan(db, { name: 'Personal Loan', lender: 'Axis Bank', kind: 'personal', original_principal_paise: null, outstanding_paise: null, interest_rate_bps: null, emi_paise: P(2000), due_day: 15, start_date: null, end_date: null, tenure_months: null, notes: 'Demo' }, { is_demo: true });

    for (let m = 1; m <= upToMonth; m++) {
      const d = (day) => `${year}-${pad(m)}-${pad(day)}`;
      for (const [loan, day] of [[home, 5], [car, 10], [personal, 15]]) {
        recordLoanPayment(db, loan.id, { kind: 'emi', date: d(day), amount_paise: loan.emi_paise }, { is_demo: true });
      }
      const wobble = ((m * 7919) % 11) / 10; // deterministic 0..1
      const save = (desc, amt) => createTransaction(db, { type: 'saving', date: d(1), amount_paise: P(amt), description: desc }, { is_demo: true });
      save('Emergency fund', 10000); save('Index fund SIP', 5000); save('Recurring deposit', 3000);
      createTransaction(db, { type: 'expense', category_key: 'necessary.fuel', date: d(8), amount_paise: P(Math.round(3800 + wobble * 800)), description: 'Fuel', merchant: 'Fuel station' }, { is_demo: true });
      createTransaction(db, { type: 'expense', category_key: 'necessary.fuel', date: d(22), amount_paise: P(Math.round(3800 + (1 - wobble) * 900)), description: 'Fuel', merchant: 'Fuel station' }, { is_demo: true });
      for (const [key, desc, base, day] of [['necessary.groceries', 'Groceries', 6500, 6], ['misc.dining', 'Food & dining', 4500, 12], ['necessary.utilities', 'Utilities', 2950, 18], ['misc.shopping', 'Shopping', 3000, 24]]) {
        createTransaction(db, { type: 'expense', category_key: key, date: d(day), amount_paise: P(Math.round(base * (0.85 + wobble * 0.3))), description: desc }, { is_demo: true });
      }
    }
    return { loaded: true };
  })();
}

/** Removes only rows flagged as demo. Real records are untouched. */
export function clearDemo(db) {
  return db.transaction(() => {
    const t = db.prepare('DELETE FROM transactions WHERE is_demo = 1').run().changes;
    db.prepare('DELETE FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE is_demo = 1)').run();
    const l = db.prepare('DELETE FROM loans WHERE is_demo = 1').run().changes;
    db.prepare('DELETE FROM salary_history WHERE is_demo = 1').run();
    db.prepare('DELETE FROM savings_accounts WHERE is_demo = 1').run();
    db.prepare('DELETE FROM savings_goals WHERE is_demo = 1').run();
    db.prepare("UPDATE profile SET display_name='', occupation='', updated_at=? WHERE id=1 AND display_name='Demo User'").run(nowIso());
    return { transactions_removed: t, loans_removed: l };
  })();
}
