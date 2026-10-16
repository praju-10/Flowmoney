import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { api } from '../services/api.js';
import { greeting, monthLabel, monthOptions, shiftMonth } from '../utils/format.js';
import Hero from '../components/dashboard/Hero.jsx';
import CategoryCards from '../components/dashboard/CategoryCards.jsx';
import Heatmap from '../components/dashboard/Heatmap.jsx';
import CategoryPanels from '../components/dashboard/CategoryPanels.jsx';

export default function HomePage() {
  const { dash } = useOutletContext();
  const { month, setMonth, version, openModal, refresh, toast } = useApp();
  const [open, setOpen] = useState(new Set(['loan'])); // Loan / EMI starts expanded, as in the reference
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const heat = useAsync(() => api.heatmap(year), [year, version]);
  const scrollTo = useRef(null);

  useEffect(() => { setYear(Number(month.slice(0, 4))); }, [month]);
  useEffect(() => {
    if (scrollTo.current) {
      document.getElementById(`acc-${scrollTo.current}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      scrollTo.current = null;
    }
  });

  const toggle = (key, scroll = true) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else { next.add(key); if (scroll) scrollTo.current = key; }
      return next;
    });
  };
  const pickCell = (m, key) => { setMonth(m); setOpen((p) => new Set(p).add(key)); scrollTo.current = key; };

  async function demo(action) {
    try { await (action === 'load' ? api.loadDemo() : api.clearDemo()); refresh(); toast(action === 'load' ? 'Demo data loaded (flagged as demo).' : 'Demo data removed. Your own records were not touched.'); }
    catch (e) { toast(e.message, 'error'); }
  }

  const d = dash.data;
  return (
    <>
      <header className="top">
        <div>
          <div className="eyebrow">{monthLabel(month).toUpperCase()}</div>
          <h1>{greeting(d?.profile.display_name)}</h1>
          <div className="sub">A clear view of what comes in, goes out, and stays yours.</div>
        </div>
        <div className="monthPicker">
          <button className="phoneOnly navArrow" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <select className="pill" aria-label="Choose month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthOptions().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button className="phoneOnly navArrow" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </header>

      {dash.error && <div className="banner error" role="alert">{dash.error.message}</div>}
      {dash.loading && !d && <div className="skeleton" aria-busy="true" />}

      {d && (
        <>
          {d.has_demo && (
            <div className="banner" role="note">
              <span><b>Demo data is showing.</b> These are sample values, not your real records.</span>
              <button className="smallBtn" onClick={() => demo('clear')}>Remove demo data</button>
            </div>
          )}
          {d.is_empty && (
            <div className="panel emptyState">
              <h3>Welcome to FlowMoney</h3>
              <p>Nothing here yet. Start by setting your salary, then add your first transaction or loan — or look around with sample data first.</p>
              <div className="btnRow">
                <button className="primary" onClick={() => openModal('profile')}>Set up profile & salary</button>
                <button className="secondary" onClick={() => openModal('transaction')}>Add a transaction</button>
                <button className="secondary" onClick={() => demo('load')}>Load demo data</button>
              </div>
            </div>
          )}
          <Hero s={d.summary} />
          <div className="sectionHead">
            <div><h2>Spending overview</h2><p>Choose a category to explore the details.</p></div>
            <button className="smallBtn" onClick={() => openModal('transaction')}>＋ Add transaction</button>
          </div>
          <CategoryCards s={d.summary} open={open} onToggle={toggle} />
          <Heatmap data={heat.data} year={year} onYear={setYear} onPick={pickCell} />
          <div className="sectionHead">
            <div><h2>Category breakdown</h2><p>Expand a section to see individual items.</p></div>
            <button className="smallBtn" onClick={() => setOpen(new Set())}>Collapse all</button>
          </div>
          <CategoryPanels dash={d} open={open} onToggle={toggle} />
        </>
      )}
    </>
  );
}
