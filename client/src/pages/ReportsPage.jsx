import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { api } from '../services/api.js';
import { GROUPS } from '../utils/categories.js';
import { compactINR, formatINR, monthLabel, monthOptions, shortMonth, STATUS_LABEL } from '../utils/format.js';

const GCOLOR = Object.fromEntries(GROUPS.map((g) => [g.key, g.color]));
const GNAME = Object.fromEntries(GROUPS.map((g) => [g.key, g.name]));
const AXIS = { stroke: '#8e9dbc', tickLine: false, axisLine: false, fontSize: 11 };

function useReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function MoneyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  if (!rows.length) return null;
  return (
    <div className="chartTip">
      {label && <b>{label}</b>}
      {rows.map((p) => (
        <div key={p.dataKey ?? p.name}><i style={{ background: p.color || p.payload?.fill }} />{p.name}: {formatINR(p.value)}</div>
      ))}
    </div>
  );
}

const Money = ({ v, tone }) => (v == null ? <span className="muted">—</span> : <span className={tone && v < 0 ? 'overspent' : ''}>{formatINR(v)}</span>);

export default function ReportsPage() {
  const { month, setMonth, version } = useApp();
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const reduced = useReducedMotion();
  const yr = useAsync(() => api.reportYear(year), [year, version]);
  const mr = useAsync(() => api.reportMonth(month), [month, version]);
  useEffect(() => { setYear(Number(month.slice(0, 4))); }, [month]);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => thisYear + 1 - i);
  const d = yr.data;
  const hasAny = d?.months.some((m) => m.has_data);

  const chartRows = (d?.months || []).map((m, i) => {
    const show = m.has_data && m.status !== 'upcoming'; // never draw bars for months with nothing recorded
    const v = (x) => (show ? x : null);
    return {
      name: shortMonth(i),
      'Loan / EMI': v(m.loan_paise), Saving: v(m.saving_paise), 'Necessary expenses': v(m.necessary_paise), Misc: v(m.misc_paise),
      Income: v(m.income_paise), Spent: v(m.spent_paise), Saved: v(m.saving_paise), Remaining: v(m.remaining_paise),
    };
  });

  return (
    <>
      <header className="top">
        <div>
          <div className="eyebrow">REPORTS · {year}</div>
          <h1>Reports</h1>
          <div className="sub">Built from your real records — the same numbers as the dashboard.</div>
        </div>
        <div className="btnRow" style={{ margin: 0 }}>
          <select className="pill" aria-label="Report year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="pill" aria-label="Report month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthOptions().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </header>

      {yr.error && <div className="banner error" role="alert">{yr.error.message}</div>}
      {yr.loading && !d && <div className="skeleton" aria-busy="true" />}

      {d && !hasAny && (
        <div className="panel emptyState">
          <h3>No records for {year} yet</h3>
          <p>Add a salary and a few transactions and your charts will appear here. Nothing is estimated or filled in for months with no data.</p>
        </div>
      )}

      {d && hasAny && (
        <>
          <section className="kpis" aria-label={`${year} totals`}>
            <div className="panel"><label>Income</label><div className="big">{formatINR(d.totals.income_paise)}</div><div className="sub">{d.totals.months_counted} month{d.totals.months_counted === 1 ? '' : 's'} with data</div></div>
            <div className="panel"><label>Spent</label><div className="big">{formatINR(d.totals.spent_paise)}</div><div className="sub">{d.totals.avg_monthly_spent_paise != null ? `avg ${formatINR(d.totals.avg_monthly_spent_paise)} / month` : '—'}</div></div>
            <div className="panel"><label>Saved</label><div className="big">{formatINR(d.totals.saving_paise)}</div><div className="sub">{d.totals.savings_rate_pct}% of income</div></div>
            <div className="panel"><label>Remaining</label><div className={`big ${d.totals.remaining_paise < 0 ? 'overspent' : ''}`}>{formatINR(d.totals.remaining_paise)}</div><div className="sub">after spending and saving</div></div>
          </section>

          <div className="reportGrid">
            <section className="panel chartCard" aria-label="Monthly outflow by category">
              <h3>Where the money went</h3>
              <p className="muted">Monthly total per category, {year}.</p>
              <div role="img" aria-label="Stacked bar chart of monthly Loan, Saving, Necessary and Misc totals. The table below has the same figures.">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1b2b48" vertical={false} />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis {...AXIS} width={44} tickFormatter={compactINR} />
                    <Tooltip content={<MoneyTip />} cursor={{ fill: '#ffffff08' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Loan / EMI" stackId="a" fill={GCOLOR.loan} isAnimationActive={!reduced} />
                    <Bar dataKey="Saving" stackId="a" fill={GCOLOR.saving} isAnimationActive={!reduced} />
                    <Bar dataKey="Necessary expenses" stackId="a" fill={GCOLOR.necessary} isAnimationActive={!reduced} />
                    <Bar dataKey="Misc" stackId="a" fill={GCOLOR.misc} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel chartCard" aria-label="Income versus spending">
              <h3>Income, spending and what's left</h3>
              <p className="muted">Months with nothing recorded are left blank, not drawn as zero.</p>
              <div role="img" aria-label="Line chart of monthly income, spent, saved and remaining. The table below has the same figures.">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1b2b48" vertical={false} />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis {...AXIS} width={44} tickFormatter={compactINR} />
                    <Tooltip content={<MoneyTip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Income" stroke="#7695ff" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={!reduced} />
                    <Line type="monotone" dataKey="Spent" stroke="#ffad65" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={!reduced} />
                    <Line type="monotone" dataKey="Saved" stroke="#4ce0c0" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={!reduced} />
                    <Line type="monotone" dataKey="Remaining" stroke="#b68aff" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={!reduced} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="panel tableWrap" aria-label="Month-end totals">
            <div className="tableHead">
              <h3>Month-end totals</h3>
              <p className="muted">A month's Necessary and Misc sums become <b>final</b> once its last date has passed. The current month shows what has been recorded so far.</p>
            </div>
            <table className="txTable monthTable">
              <thead>
                <tr><th>Month</th><th>Status</th><th className="num hl">Necessary</th><th className="num hl">Misc</th><th className="num">Loan / EMI</th><th className="num">Saving</th><th className="num">Spent</th><th className="num">Remaining</th></tr>
              </thead>
              <tbody>
                {d.months.map((m, i) => {
                  const blank = !m.has_data || m.status === 'upcoming';
                  return (
                    <tr key={m.month} className={m.month === month ? 'current' : ''}>
                      <td><button className="linkBtn" onClick={() => setMonth(m.month)}>{shortMonth(i)} {year}</button></td>
                      <td>{blank ? <span className="muted">{m.status === 'upcoming' ? 'Upcoming' : 'No data'}</span> : <span className={`tag ${m.status === 'final' ? 'ok' : 'idle'}`}>{STATUS_LABEL[m.status]}</span>}</td>
                      <td className="num hl"><Money v={blank ? null : m.necessary_paise} /></td>
                      <td className="num hl"><Money v={blank ? null : m.misc_paise} /></td>
                      <td className="num"><Money v={blank ? null : m.loan_paise} /></td>
                      <td className="num"><Money v={blank ? null : m.saving_paise} /></td>
                      <td className="num"><Money v={blank ? null : m.spent_paise} /></td>
                      <td className="num"><Money v={blank ? null : m.remaining_paise} tone /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Completed months ({d.final_totals.months_counted})</td>
                  <td className="num hl"><Money v={d.final_totals.necessary_paise} /></td>
                  <td className="num hl"><Money v={d.final_totals.misc_paise} /></td>
                  <td className="num"><Money v={d.final_totals.loan_paise} /></td>
                  <td className="num"><Money v={d.final_totals.saving_paise} /></td>
                  <td className="num"><Money v={d.final_totals.spent_paise} /></td>
                  <td className="num"><Money v={d.final_totals.remaining_paise} tone /></td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}

      {mr.error && <div className="banner error" role="alert">{mr.error.message}</div>}
      {mr.data && (
        <>
          <div className="sectionHead">
            <div>
              <h2>{monthLabel(month)} in detail <span className={`tag ${mr.data.month_status === 'final' ? 'ok' : 'idle'}`}>{STATUS_LABEL[mr.data.month_status]}</span></h2>
              <p>Compared with {monthLabel(mr.data.previous_month)}.</p>
            </div>
          </div>
          <div className="reportGrid">
            <section className="panel chartCard" aria-label="Category split">
              <h3>Category split</h3>
              {mr.data.comparison.some((c) => c.current_paise > 0) ? (
                <div role="img" aria-label={`Donut chart of ${monthLabel(month)} totals by category. The comparison table lists the same figures.`}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={mr.data.comparison.filter((c) => c.current_paise > 0).map((c) => ({ name: GNAME[c.group], value: c.current_paise, fill: GCOLOR[c.group] }))}
                        dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none" isAnimationActive={!reduced}>
                        {mr.data.comparison.filter((c) => c.current_paise > 0).map((c) => <Cell key={c.group} fill={GCOLOR[c.group]} />)}
                      </Pie>
                      <Tooltip content={<MoneyTip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="empty">Nothing recorded for this month.</div>}
            </section>

            <section className="panel" aria-label="Month comparison">
              <h3>This month vs last month</h3>
              <table className="txTable">
                <thead><tr><th>Category</th><th className="num">This month</th><th className="num">Last month</th><th className="num">Change</th></tr></thead>
                <tbody>
                  {mr.data.comparison.map((c) => (
                    <tr key={c.group}>
                      <td><i className="dot" style={{ background: GCOLOR[c.group] }} />{GNAME[c.group]}</td>
                      <td className="num">{formatINR(c.current_paise)}</td>
                      <td className="num">{formatINR(c.previous_paise)}</td>
                      <td className="num">{c.change_pct == null ? <span className="muted">—</span> : `${c.change_pct > 0 ? '↑' : c.change_pct < 0 ? '↓' : ''} ${Math.abs(c.change_pct)}%`}</td>
                    </tr>
                  ))}
                  <tr className="sumRow">
                    <td>Remaining</td><td className="num" colSpan={3}><Money v={mr.data.summary.remaining_paise} tone /></td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>

          <div className="reportGrid">
            {['necessary', 'misc'].map((g) => {
              const list = mr.data.subcategories.filter((s) => s.group === g);
              const max = Math.max(...list.map((s) => s.total_paise), 1);
              const total = list.reduce((a, s) => a + s.total_paise, 0);
              return (
                <section className="panel" key={g} aria-label={`${GNAME[g]} breakdown`}>
                  <h3>{GNAME[g]} <span className="muted">· {formatINR(total)}</span></h3>
                  {list.length === 0 && <div className="empty">No entries this month.</div>}
                  {list.map((s) => (
                    <div className="barRow" key={s.name}>
                      <span>{s.name}</span>
                      <div className="miniBar"><i style={{ width: `${(s.total_paise / max) * 100}%`, background: GCOLOR[g] }} /></div>
                      <span className="num">{formatINR(s.total_paise)}</span>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>

          <section className="panel tableWrap" aria-label="Loans">
            <div className="tableHead"><h3>Loans</h3><p className="muted">Outstanding balances appear only when you've entered them.</p></div>
            {mr.data.loans.length === 0 ? <div className="empty">No loans recorded.</div> : (
              <table className="txTable">
                <thead><tr><th>Loan</th><th>Lender</th><th className="num">EMI</th><th className="num">Outstanding</th><th className="num">Paid so far</th><th>This month</th></tr></thead>
                <tbody>
                  {mr.data.loans.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.name}</strong></td><td>{l.lender || '—'}</td>
                      <td className="num">{formatINR(l.emi_paise)}</td>
                      <td className="num"><Money v={l.outstanding_paise} /></td>
                      <td className="num">{formatINR(l.total_paid_paise)}</td>
                      <td><span className={`tag ${l.status === 'paid' ? 'ok' : l.status === 'overdue' ? 'warn' : 'idle'}`}>{l.status[0].toUpperCase() + l.status.slice(1)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}
