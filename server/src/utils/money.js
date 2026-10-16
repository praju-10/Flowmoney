// All money is stored as integer paise (1 INR = 100 paise). Never use floats for stored amounts.
export function toPaise(value) {
  if (typeof value === 'string') value = value.replace(/[₹,\s]/g, '');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError('Invalid amount');
  // Round on the decimal string representation to avoid 1.005 * 100 = 100.49999 issues
  return Math.round(Number((Math.abs(n) * 100).toFixed(4))) * Math.sign(n || 1);
}
export const fromPaise = (p) => p / 100;
export const pct = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);
export function formatINR(paise, { decimals = 0 } = {}) {
  const v = paise / 100;
  return '₹ ' + v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
