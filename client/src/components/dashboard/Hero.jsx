import { formatINR, pctLabel } from '../../utils/format.js';

export default function Hero({ s }) {
  const over = s.remaining_paise < 0;
  return (
    <section className="hero" aria-label="Monthly summary">
      <div className="heroGrid">
        <div className="metric">
          <label>Monthly salary</label>
          <div className="big">{formatINR(s.salary_paise)}</div>
          <div className="sub" style={{ marginTop: 3 }}>
            {s.extra_income_paise > 0 ? `+ ${formatINR(s.extra_income_paise)} other income` : 'Your monthly income'}
          </div>
        </div>
        <div className="metric">
          <label>Total spent</label>
          <div className="big">{formatINR(s.spent_paise)}</div>
          <div className="sub">{pctLabel(s.spent_pct, s.income_paise)}</div>
          <div className="bar"><i style={{ width: `${Math.min(100, s.spent_pct)}%` }} /></div>
        </div>
        <div className="metric">
          <label>Total saved</label>
          <div className="big">{formatINR(s.saved_paise)}</div>
          <div className="sub">{s.income_paise > 0 ? `${s.saved_pct.toFixed(1)}% of salary saved` : 'Add a salary to see %'}</div>
          <div className="bar"><i style={{ width: `${Math.min(100, s.saved_pct)}%`, background: 'linear-gradient(90deg,#9a78ff,#d0a1ff)' }} /></div>
        </div>
        <div className="metric">
          <label>Remaining</label>
          <div className={`big ${over ? 'overspent' : ''}`}>{formatINR(s.remaining_paise)}</div>
          <div className="sub">
            {over ? 'Spending and saving exceed income' : s.income_paise > 0 ? `${s.remaining_pct.toFixed(1)}% of salary left` : 'Left after spending and saving'}
          </div>
          <div className="bar"><i style={{ width: `${over ? 100 : Math.min(100, s.remaining_pct)}%`, background: over ? 'linear-gradient(90deg,#ff9a9a,#ffb58a)' : 'linear-gradient(90deg,#ffd479,#ffad65)' }} /></div>
        </div>
      </div>
      <details className="calcNote"><summary>How are these calculated?</summary><p>{s.calculation_note}</p></details>
    </section>
  );
}
