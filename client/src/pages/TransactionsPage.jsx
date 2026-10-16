import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { api } from '../services/api.js';
import { formatINRExact, monthLabel, monthOptions } from '../utils/format.js';
import { TYPE_LABEL } from '../utils/categories.js';

export default function TransactionsPage() {
  const { month, version, openModal } = useApp();
  const [f, setF] = useState({ scope: 'month', search: '', type: '', sort: 'date', dir: 'desc', page: 1 });
  const set = (patch) => setF((p) => ({ ...p, page: 1, ...patch }));
  const query = { month: f.scope === 'month' ? month : '', search: f.search, type: f.type, sort: f.sort, dir: f.dir, page: f.page, limit: 25 };
  const { data, error, loading } = useAsync(() => api.transactions(query), [JSON.stringify(query), version]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <header className="top">
        <div>
          <div className="eyebrow">{f.scope === 'month' ? monthLabel(month).toUpperCase() : 'ALL TIME'}</div>
          <h1>Transactions</h1>
          <div className="sub">Every rupee in and out, in one place.</div>
        </div>
        <button className="primary" onClick={() => openModal('transaction')}>＋ Add transaction</button>
      </header>

      <div className="filters">
        <input className="pill grow" type="search" placeholder="Search description or merchant" aria-label="Search" value={f.search} onChange={(e) => set({ search: e.target.value })} />
        <select className="pill" aria-label="Period" value={f.scope} onChange={(e) => set({ scope: e.target.value })}>
          <option value="month">{monthLabel(month)}</option><option value="all">All time</option>
        </select>
        <select className="pill" aria-label="Type" value={f.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="pill" aria-label="Sort" value={`${f.sort}:${f.dir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(':'); set({ sort, dir }); }}>
          <option value="date:desc">Newest first</option><option value="date:asc">Oldest first</option>
          <option value="amount:desc">Largest first</option><option value="amount:asc">Smallest first</option>
        </select>
      </div>

      {error && <div className="banner error" role="alert">{error.message}</div>}
      <div className="panel tableWrap cardsWrap">
        <table className="txTable cardsOnPhone">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th className="num">Amount</th><th className="num" title="Balance left after this entry. Shown when filtered to a month.">Left after</th><th /></tr></thead>
          <tbody>
            {data?.items.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td><strong>{t.description || t.category_name}</strong>{t.merchant && <small> · {t.merchant}</small>}</td>
                <td>{t.category_name}</td>
                <td><span className={`tag ${t.type === 'income' ? 'ok' : 'idle'}`}>{TYPE_LABEL[t.type]}</span></td>
                <td className="num">{t.type === 'refund' ? '−' : ''}{formatINRExact(t.amount_paise)}</td>
                <td className={`num ${t.remaining_after_paise < 0 ? 'overspent' : 'muted'}`}>{t.remaining_after_paise != null ? formatINRExact(t.remaining_after_paise) : '—'}</td>
                <td className="rowActions">
                  {!t.loan_payment_kind && <button className="smallBtn" onClick={() => openModal('transaction', { tx: t })}>Edit</button>}
                  <button className="smallBtn danger" onClick={() => openModal('confirm', { title: 'Delete this transaction?', message: 'This permanently removes it and updates every total.', action: () => api.deleteTransaction(t.id), doneMessage: 'Transaction deleted.' })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data?.items.length === 0 && <div className="empty">No transactions match. Try a different filter, or add one.</div>}
      </div>
      <div className="pager">
        <span className="muted">{data ? `${data.total} transaction${data.total === 1 ? '' : 's'}` : ''}</span>
        <div>
          <button className="secondary" disabled={f.page <= 1} onClick={() => setF((p) => ({ ...p, page: p.page - 1 }))}>‹ Prev</button>
          <span className="muted" style={{ margin: '0 10px' }}>Page {f.page} of {pages}</span>
          <button className="secondary" disabled={f.page >= pages} onClick={() => setF((p) => ({ ...p, page: p.page + 1 }))}>Next ›</button>
        </div>
      </div>
      <p className="muted">Not built yet: CSV export and amount/date-range filters (the API already supports them).</p>
    </>
  );
}
