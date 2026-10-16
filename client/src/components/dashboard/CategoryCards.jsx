import { GROUPS, MONTH_END_GROUPS } from '../../utils/categories.js';
import { formatINR, pctLabel } from '../../utils/format.js';

const NOTE = { final: 'Final month total', in_progress: 'So far — final when the month ends', upcoming: 'Month not started' };

export default function CategoryCards({ s, open, onToggle }) {
  return (
    <div className="cards">
      {GROUPS.map((g) => {
        const grp = s.groups[g.key];
        return (
          <button key={g.key} className="category" aria-expanded={open.has(g.key)} aria-controls={`acc-${g.key}`}
            onClick={() => onToggle(g.key)}
            style={{ textAlign: 'left', color: 'inherit', borderColor: `${g.color}55`, background: `linear-gradient(145deg,${g.tint},#0b1425)` }}>
            <div className="catTop">
              <span className="orb" style={{ color: g.color, background: `${g.color}12` }}>{g.icon}</span>
              <span style={{ color: '#9eafd2' }}>↗</span>
            </div>
            <h3>{g.name}</h3>
            <div className="amount">{formatINR(grp.total_paise)}</div>
            <div className="muted">{pctLabel(grp.pct_of_income, s.income_paise)}</div>
            <div className="miniBar"><i style={{ width: `${Math.min(100, grp.pct_of_income)}%`, background: g.color }} /></div>
            {MONTH_END_GROUPS.includes(g.key) && <div className={`monthNote ${s.month_status}`}>{NOTE[s.month_status]}</div>}
          </button>
        );
      })}
    </div>
  );
}
