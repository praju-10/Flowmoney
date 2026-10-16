-- FlowMoney schema v1. Money = integer paise. Dates = 'YYYY-MM-DD' text.
-- Single source of truth: every amount that affects totals lives in `transactions`.
-- loan_payments / savings links reference a transaction; they never store a second copy of the amount.

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL DEFAULT '',
  occupation TEXT NOT NULL DEFAULT '',
  email TEXT, phone TEXT, avatar_data TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  savings_goal_paise INTEGER NOT NULL DEFAULT 0 CHECK (savings_goal_paise >= 0),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE salary_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_from TEXT NOT NULL UNIQUE,         -- first day the salary applies
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  gross_paise INTEGER CHECK (gross_paise IS NULL OR gross_paise >= 0),
  pay_day INTEGER CHECK (pay_day IS NULL OR pay_day BETWEEN 1 AND 31),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_key TEXT NOT NULL CHECK (group_key IN ('loan','saving','necessary','misc','income','transfer')),
  parent_id INTEGER REFERENCES categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, lender TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'other',
  original_principal_paise INTEGER CHECK (original_principal_paise IS NULL OR original_principal_paise >= 0),
  outstanding_paise INTEGER CHECK (outstanding_paise IS NULL OR outstanding_paise >= 0),
  interest_rate_bps INTEGER CHECK (interest_rate_bps IS NULL OR interest_rate_bps >= 0), -- 8.5% = 850
  emi_paise INTEGER NOT NULL CHECK (emi_paise > 0),
  due_day INTEGER CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  start_date TEXT, end_date TEXT, tenure_months INTEGER CHECK (tenure_months IS NULL OR tenure_months > 0),
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE savings_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general',        -- emergency|general|rd|fd|mutual_fund|investment|custom
  current_balance_paise INTEGER CHECK (current_balance_paise IS NULL OR current_balance_paise >= 0),
  contribution_paise INTEGER CHECK (contribution_paise IS NULL OR contribution_paise >= 0),
  frequency TEXT, target_paise INTEGER, start_date TEXT, maturity_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_paise INTEGER NOT NULL CHECK (target_paise > 0),
  current_paise INTEGER NOT NULL DEFAULT 0 CHECK (current_paise >= 0),
  target_date TEXT, monthly_target_paise INTEGER, priority INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_filename TEXT NOT NULL, sheet_name TEXT,
  imported_count INTEGER NOT NULL DEFAULT 0, skipped_count INTEGER NOT NULL DEFAULT 0, invalid_count INTEGER NOT NULL DEFAULT 0,
  undone_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,                         -- uuid
  date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),  -- always positive; `type` gives direction
  type TEXT NOT NULL CHECK (type IN ('income','expense','saving','loan_payment','transfer','refund')),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  description TEXT NOT NULL DEFAULT '',
  merchant TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL,
  savings_account_id INTEGER REFERENCES savings_accounts(id) ON DELETE SET NULL,
  goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  refund_of TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  import_batch_id INTEGER REFERENCES import_batches(id),
  source_row TEXT,                              -- e.g. "Sheet1!12" for imported rows
  dedupe_key TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_tx_date ON transactions(date);
CREATE INDEX idx_tx_type_date ON transactions(type, date);
CREATE INDEX idx_tx_category_date ON transactions(category_id, date);
CREATE INDEX idx_tx_loan ON transactions(loan_id);
CREATE INDEX idx_tx_batch ON transactions(import_batch_id);
CREATE INDEX idx_tx_dedupe ON transactions(dedupe_key);

CREATE TABLE fuel_details (
  transaction_id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  litres_milli INTEGER CHECK (litres_milli IS NULL OR litres_milli > 0),   -- 12.5 L = 12500
  price_per_litre_paise INTEGER, odometer_km INTEGER, station TEXT NOT NULL DEFAULT ''
);

-- Metadata about a loan payment. The money itself is in `transactions` (no duplicated amount).
CREATE TABLE loan_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                         -- 'YYYY-MM' the payment settles
  kind TEXT NOT NULL CHECK (kind IN ('emi','prepayment')),
  principal_paise INTEGER CHECK (principal_paise IS NULL OR principal_paise >= 0), -- only if user supplies actuals
  interest_paise INTEGER CHECK (interest_paise IS NULL OR interest_paise >= 0)
);
-- One EMI per loan per period (prevents accidental duplicates)
CREATE UNIQUE INDEX uq_emi_period ON loan_payments(loan_id, period) WHERE kind = 'emi';

CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,                          -- 'YYYY-MM'
  scope TEXT NOT NULL CHECK (scope IN ('overall','loan','saving','necessary','misc')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  warn_at_pct INTEGER NOT NULL DEFAULT 80 CHECK (warn_at_pct BETWEEN 1 AND 100),
  UNIQUE (month, scope)
);

CREATE TABLE recurring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_json TEXT NOT NULL, day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  active INTEGER NOT NULL DEFAULT 1, last_generated_month TEXT, created_at TEXT NOT NULL
);

CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Seed: system categories (not demo data; required for the app to function)
INSERT INTO categories (key,name,group_key,sort_order,is_system) VALUES
 ('loan','Loan / EMI','loan',1,1),
 ('saving','Saving','saving',2,1),
 ('necessary','Necessary expenses','necessary',3,1),
 ('misc','Misc','misc',4,1),
 ('income','Income','income',5,1),
 ('transfer','Transfer','transfer',6,1);
-- Necessary expenses: things you must pay for. Misc: everything discretionary.
INSERT INTO categories (key,name,group_key,parent_id,sort_order,is_system)
 SELECT 'necessary.'||k, n, 'necessary', (SELECT id FROM categories WHERE key='necessary'), o, 0 FROM (
  SELECT 'fuel' k,'Fuel / commute' n,1 o UNION ALL SELECT 'groceries','Groceries',2 UNION ALL SELECT 'utilities','Utilities',3
  UNION ALL SELECT 'internet','Internet & mobile',4 UNION ALL SELECT 'medical','Medical',5
  UNION ALL SELECT 'rent','Rent',6 UNION ALL SELECT 'insurance','Insurance',7 UNION ALL SELECT 'household','Household',8);
INSERT INTO categories (key,name,group_key,parent_id,sort_order,is_system)
 SELECT 'misc.'||k, n, 'misc', (SELECT id FROM categories WHERE key='misc'), o, 0 FROM (
  SELECT 'dining' k,'Food & dining' n,1 o UNION ALL SELECT 'shopping','Shopping',2 UNION ALL SELECT 'entertainment','Entertainment',3
  UNION ALL SELECT 'travel','Travel',4 UNION ALL SELECT 'subscriptions','Subscriptions',5 UNION ALL SELECT 'other','Other',6);
INSERT INTO profile (id,created_at,updated_at) VALUES (1,datetime('now'),datetime('now'));
INSERT INTO app_settings (key,value) VALUES ('spent_includes_loans','1');
