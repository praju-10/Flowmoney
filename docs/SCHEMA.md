# Database schema (SQLite, migration `001_init.sql`)

Money is stored as **integer paise**. Dates are `YYYY-MM-DD` text; months are `YYYY-MM`.

**Single source of truth:** every amount that affects a total lives in `transactions`. Everything else only *references* a transaction.

| Table | Purpose |
|---|---|
| `profile` | one row: name, occupation, currency, monthly savings goal |
| `salary_history` | salary per `effective_from`; never rewritten retroactively |
| `categories` | 4 main groups (loan / saving / necessary / misc) + income/transfer; Necessary and Misc have sub-categories |
| `transactions` | every income/expense/saving/loan_payment/transfer/refund |
| `fuel_details` | litres, odometer, station — stored only for the *Fuel / commute* sub-category of Necessary expenses |
| `loans` | loan terms and outstanding principal |
| `loan_payments` | metadata for a payment (period, kind, principal/interest actuals) — **amount is not duplicated**; unique index prevents two EMIs for one loan+month |
| `savings_accounts`, `savings_goals`, `vehicles`, `budgets`, `recurring_rules`, `import_batches`, `app_settings` | created now, UI/API in later stages |

Adaptations vs. the brief's list: `savings_contributions` is **not** a separate table — a contribution is a `saving` transaction
linked by `savings_account_id`, so a contribution can never be counted twice. `budget_categories` is folded into `budgets.scope`. `imported_rows` is replaced by `transactions.import_batch_id` + `source_row` (stage 2).

## Calculation rules (implemented in `server/src/services/financeService.js`)
- Spent = Loan/EMI + Necessary + Misc (net of refunds). Savings are never "spent". Transfers are excluded everywhere.
- A refund reduces its group's total but never below zero.
- Setting `spent_includes_loans = 0` removes loans from "Spent"; the UI note states which rule is active.
- Percentages are relative to the month's income (salary effective that month + any income transactions); 0 income ⇒ 0%, shown as "Add a salary to see %".
- Remaining = income − (Loan + Saving + Necessary + Misc). Negative means overspent and is displayed as negative.
- "Left after this entry" starts from the month's salary and applies entries in date order (then the order they were added): income and refunds add; expenses, savings and loan payments subtract; transfers are ignored.
- A month is **final** once its last date has passed; the current month is *in progress* and future months are *upcoming*. Averages and year totals exclude upcoming months.
- Necessary = Fuel / commute, Groceries, Utilities, Internet & mobile, Medical, Rent, Insurance, Household. Misc = Food & dining, Shopping, Entertainment, Travel, Subscriptions, Other.
