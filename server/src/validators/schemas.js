import { z } from 'zod';
import { isValidDate, MONTH_RE } from '../utils/dates.js';
import { toPaise } from '../utils/money.js';

const date = z.string().refine(isValidDate, 'Invalid date (use YYYY-MM-DD)');
export const month = z.string().regex(MONTH_RE, 'Invalid month (use YYYY-MM)');
const MAX_PAISE = 100_000_000_00; // ₹100 crore sanity ceiling

/** API accepts rupees (up to 2 decimals); the server converts to integer paise. */
const rupees = z.coerce.number({ invalid_type_error: 'Enter a valid amount' })
  .refine((n) => Number.isFinite(n) && n > 0, 'Amount must be greater than zero')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'At most 2 decimal places')
  .refine((n) => toPaise(n) <= MAX_PAISE, 'Amount is too large')
  .transform(toPaise);
const optRupees = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().min(0).optional()).transform((n) => (n == null ? null : toPaise(n)));
const text = (max = 200) => z.string().trim().max(max).optional().default('');
const optInt = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().int().positive().optional()).transform((n) => n ?? null);

const fuel = z.object({
  litres_milli: z.preprocess((v) => (v === '' || v == null ? undefined : Math.round(Number(v) * 1000)), z.number().int().positive().optional()),
  price_per_litre_paise: z.preprocess((v) => (v === '' || v == null ? undefined : Math.round(Number(v) * 100)), z.number().int().positive().optional()),
  odometer_km: optInt,
  station: text(100),
}).optional();

export const transactionInput = z.object({
  date, amount: rupees,
  type: z.enum(['income', 'expense', 'saving', 'loan_payment', 'transfer', 'refund']),
  category_id: z.coerce.number().int().positive().optional(),
  category_key: z.string().max(60).optional(),
  description: text(200), merchant: text(120), payment_method: text(60), notes: text(1000),
  savings_account_id: optInt, goal_id: optInt, vehicle_id: optInt, fuel,
}).transform(({ amount, ...rest }) => ({ ...rest, amount_paise: amount }));

export const transactionQuery = z.object({
  month: month.optional(), year: z.coerce.number().int().min(1990).max(2200).optional(),
  from: date.optional(), to: date.optional(),
  type: z.enum(['income', 'expense', 'saving', 'loan_payment', 'transfer', 'refund']).optional(),
  group: z.enum(['loan', 'saving', 'necessary', 'misc', 'income', 'transfer']).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  min: z.coerce.number().min(0).optional(), max: z.coerce.number().min(0).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['date', 'amount']).default('date'), dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(200).default(50),
}).transform(({ min, max, ...r }) => ({ ...r, min_paise: min == null ? null : toPaise(min), max_paise: max == null ? null : toPaise(max) }));

export const profileInput = z.object({
  display_name: z.string().trim().min(1, 'Name is required').max(80),
  occupation: text(80),
  email: z.string().trim().email().max(120).optional().or(z.literal('')).transform((v) => v || null),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  currency: z.string().length(3).default('INR'),
  savings_goal: z.coerce.number().min(0).default(0),
}).transform(({ savings_goal, ...r }) => ({ ...r, savings_goal_paise: toPaise(savings_goal) }));

export const salaryInput = z.object({
  amount: z.coerce.number().min(0), effective_from: date,
  gross: z.coerce.number().min(0).optional(), pay_day: z.coerce.number().int().min(1).max(31).optional(),
}).transform(({ amount, gross, pay_day, effective_from }) => ({
  amount_paise: toPaise(amount), gross_paise: gross == null ? null : toPaise(gross), pay_day: pay_day ?? null, effective_from,
}));

export const loanInput = z.object({
  name: z.string().trim().min(1).max(80), lender: text(80), kind: z.enum(['home', 'car', 'personal', 'education', 'other']).default('other'),
  original_principal: optRupees, outstanding: optRupees,
  interest_rate: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(0).max(100).optional()),
  emi: rupees,
  due_day: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().min(1).max(31).optional()),
  start_date: z.preprocess((v) => v || undefined, date.optional()), end_date: z.preprocess((v) => v || undefined, date.optional()),
  tenure_months: optInt, notes: text(1000),
}).refine((v) => v.outstanding == null || v.original_principal == null || v.outstanding <= v.original_principal, { message: 'Outstanding cannot exceed the original principal', path: ['outstanding'] })
  .transform((v) => ({
    name: v.name, lender: v.lender, kind: v.kind,
    original_principal_paise: v.original_principal, outstanding_paise: v.outstanding,
    interest_rate_bps: v.interest_rate == null ? null : Math.round(v.interest_rate * 100),
    emi_paise: v.emi, due_day: v.due_day ?? null, start_date: v.start_date ?? null, end_date: v.end_date ?? null,
    tenure_months: v.tenure_months, notes: v.notes,
  }));

export const loanPaymentInput = z.object({
  date, amount: rupees, kind: z.enum(['emi', 'prepayment']).default('emi'),
  period: month.optional(), principal: optRupees, interest: optRupees, notes: text(500),
}).transform(({ amount, principal, interest, ...r }) => ({ ...r, amount_paise: amount, principal_paise: principal, interest_paise: interest }));

export const demoInput = z.object({ year: z.coerce.number().int().optional(), month: z.coerce.number().int().min(1).max(12).optional() });
