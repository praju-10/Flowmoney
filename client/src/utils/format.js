// Display formatting only. Stored values are integer paise; conversion happens here and nowhere else.
export const formatINR = (paise) => {
  const r = Math.round((Number(paise) || 0) / 100);
  return `${r < 0 ? '−' : ''}₹ ${Math.abs(r).toLocaleString('en-IN')}`;
};
/** Short form for tight spaces (heatmap cells, chart axes): 950 · 12.4k · 1.2L (lakh) · 1.1Cr */
export const compactINR = (paise) => {
  const r = Math.abs(Math.round((Number(paise) || 0) / 100));
  const trim = (n) => String(Number(n.toFixed(1)));
  if (r >= 10000000) return `${trim(r / 10000000)}Cr`;
  if (r >= 100000) return `${trim(r / 100000)}L`;
  if (r >= 1000) return `${trim(r / 1000)}k`;
  return String(r);
};
export const formatINRExact = (paise) => {
  const v = (Number(paise) || 0) / 100;
  return `${v < 0 ? '−' : ''}₹ ${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const paiseToInput = (paise) => (paise == null ? '' : String(paise / 100));

export const currentMonth = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthLabel = (m) => new Date(`${m}-02`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const shortMonth = (i) => new Date(2000, i, 2).toLocaleDateString('en', { month: 'short' });
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function defaultDateFor(month) {
  // New entries default to today if viewing the current month, otherwise the 1st of the viewed month.
  return month === currentMonth() ? todayISO() : `${month}-01`;
}
export function monthOptions(back = 24, forward = 6) {
  const out = [];
  const d = new Date();
  for (let i = -forward; i <= back; i++) out.push(currentMonth(new Date(d.getFullYear(), d.getMonth() - i, 2)));
  return out;
}
export const greeting = (name, d = new Date()) => {
  const h = d.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
};
export const pctLabel = (pctValue, income) => (income > 0 ? `${pctValue.toFixed(1)}% of salary` : 'Add a salary to see %');
export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const STATUS_LABEL = { final: 'Final', in_progress: 'In progress', upcoming: 'Upcoming' };
export const shiftMonth = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  return currentMonth(new Date(y, mo - 1 + delta, 2));
};
