import { GROUPS, HEAT, MONTH_END_GROUPS } from '../../utils/categories.js';
import { compactINR, formatINR, shortMonth } from '../../utils/format.js';

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export default function Heatmap({ data, year, onYear, onPick }) {
  const years = data?.years || [year];
  const completed = data?.completed || Array(12).fill(false);
  return (
    <section className="heatPanel" aria-label="Monthly spending heatmap">
      <div className="heatTitle">
        <div>
          <h3>Monthly spending heatmap</h3>
          <div className="muted">Brighter cells indicate higher spending. Necessary and Misc show their final sum once a month has ended.</div>
        </div>
        <div className="heatTools">
          <select className="pill small" aria-label="Heatmap year" value={year} onChange={(e) => onYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="legend">Low {HEAT.map((c) => <i key={c} className="sq" style={{ background: c }} />)} High</div>
        </div>
      </div>
      <div className="heatScroll">
        <div className="heatGrid heatWide" role="grid">
          <div />
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="month">{shortMonth(i)}</div>)}
          {GROUPS.map((g) => {
            const vals = data?.groups[g.key] || Array(12).fill(null);
            const max = Math.max(...vals.map((v) => v || 0), 1);
            const known = vals.filter((v) => v != null);
            const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
            const showFinal = MONTH_END_GROUPS.includes(g.key);
            return [
              <div key={`${g.key}-n`} className="rowName">{g.short}</div>,
              ...vals.map((v, i) => {
                const m = `${year}-${String(i + 1).padStart(2, '0')}`;
                const monthName = new Date(year, i, 2).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                if (v == null) {
                  return <button key={`${g.key}-${i}`} className="cell empty" style={{ opacity: 0.4 }} aria-label={`${monthName}, ${g.name}: no data`} title={`${monthName} · ${g.name}: no data`} onClick={() => onPick(m, g.key)} />;
                }
                const a = v / max;
                const diff = avg ? Math.round(((v - avg) / avg) * 100) : 0;
                const final = completed[i];
                const tip = `${monthName} · ${g.name}: ${formatINR(v)} ${final ? '(final month total)' : '(so far — month not finished)'}; ${a >= 0.995 ? 'highest month' : `${Math.round(a * 100)}% of peak`}; ${diff >= 0 ? '+' : ''}${diff}% vs this year's average`;
                return (
                  <button key={`${g.key}-${i}`} className={`cell ${showFinal && final ? 'withAmt' : ''}`} aria-label={tip} title={tip} onClick={() => onPick(m, g.key)}
                    style={{ background: rgba(HEAT[Math.min(4, Math.floor(a * 4.99))], 0.48 + a * 0.52) }}>
                    {showFinal && final && <span className="amt">{compactINR(v)}</span>}
                  </button>
                );
              }),
            ];
          })}
        </div>
      </div>
    </section>
  );
}
