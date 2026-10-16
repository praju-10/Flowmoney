// Dates are stored as local calendar dates 'YYYY-MM-DD' (no time zones). Months are 'YYYY-MM'.
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function monthBounds(month) {
  if (!MONTH_RE.test(month)) throw new RangeError('Invalid month');
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { start: `${month}-01`, end: `${next}-01` }; // [start, end)
}
export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
export const monthOf = (date) => date.slice(0, 7);
export const nowIso = () => new Date().toISOString();
