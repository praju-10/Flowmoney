import { GROUPS, MONTH_END_GROUPS } from '../../utils/categories.js';
import { formatINR, formatINRExact, ordinal, pctLabel } from '../../utils/format.js';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.jsx';

function totalLabel(g, status) {
  if (g.verb === 'saved') return 'Total saved';
  if (!MONTH_END_GROUPS.includes(g.key)) return 'Total spent';
  return status === 'final' ? 'Final month total' : status === 'in_progress' ? 'Total so far' : 'Total spent';
}

const STATUS = { paid: ['Paid', 'ok'], overdue: ['Overdue', 'warn'], pending: ['Pending', 'idle'] };

function TxRow({ t, color, total, openModal }) {
  const negative = t.type === 'refund';
  const locked = !!t.loan_payment_kind;
  return (
    <div className="entry hasAfter">
      <div>
        <strong>{t.description || t.category_name}</strong>
        <small>{[t.date, t.category_name !== t.description ? t.category_name : null, t.merchant].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="value">{negative ? '−' : ''}{formatINR(t.amount_paise)}</div>
      <div className={`after ${t.remaining_after_paise < 0 ? 'overspent' : ''}`} title="Balance left after this entry (salary and income, minus everything recorded up to here)">
        {t.remaining_after_paise != null ? `${formatINR(t.remaining_after_paise)} left` : ''}
      </div>
      <div style={{ width: 75 }}><div className="miniBar"><i style={{ width: `${total ? Math.min(100, (t.amount_paise / total) * 100) : 0}%`, background: color }} /></div></div>
      <div className="rowActions">
        {!locked && <button className="smallBtn" aria-label={`Edit ${t.description || t.category_name}`} onClick={() => openModal('transaction', { tx: t })}>Edit</button>}
        <button className="smallBtn danger" aria-label={`Delete ${t.description || t.category_name}`}
          onClick={() => openModal('confirm', {
            title: 'Delete this transaction?',
            message: locked ? 'This loan payment will be removed and any principal it reduced will be restored, so you can record it again correctly.' : 'This will permanently remove it from your records and update every total.',
            action: () => api.deleteTransaction(t.id), doneMessage: 'Transaction deleted.',
          })}>Delete</button>
      </div>
    </div>
  );
}

function LoanRow({ loan, openModal }) {
  const [label, tone] = STATUS[loan.status];
  return (
    <div className="entry hasActions loanRow">
      <div>
        <strong>{loan.name} <span className={`tag ${tone}`}>{label}</span></strong>
        <small>{[loan.lender, loan.due_day ? `due on the ${ordinal(loan.due_day)}` : null, loan.outstanding_paise != null ? `Outstanding ${formatINR(loan.outstanding_paise)}` : null].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="value">{formatINR(loan.emi_paise)} <small>/ month</small></div>
      <div style={{ width: 75 }}>
        {loan.progress_pct != null ? <div className="miniBar" title={`${loan.progress_pct}% repaid`}><i style={{ width: `${loan.progress_pct}%`, background: '#7896ff' }} /></div> : <small className="muted">—</small>}
      </div>
      <div className="rowActions">
        {loan.status !== 'paid' && <button className="smallBtn" onClick={() => openModal('payment', { loan })}>Record EMI</button>}
        <button className="smallBtn" onClick={() => openModal('payment', { loan })}>Pay…</button>
        <button className="smallBtn" onClick={() => openModal('loan', { loan })}>Edit</button>
        <button className="smallBtn danger" onClick={() => openModal('confirm', {
          title: `Delete ${loan.name}?`, message: 'The loan is removed. Past payments stay in your transaction history so your totals do not change.',
          action: () => api.deleteLoan(loan.id), doneMessage: 'Loan deleted.' })}>Delete</button>
      </div>
    </div>
  );
}

export default function CategoryPanels({ dash, open, onToggle }) {
  const { openModal } = useApp();
  const s = dash.summary;
  return (
    <div className="accordions">
      {GROUPS.map((g) => {
        const grp = s.groups[g.key];
        const txs = dash.transactions[g.key] || [];
        return (
          <section key={g.key} className={`accordion ${open.has(g.key) ? 'open' : ''}`} id={`acc-${g.key}`}>
            <div className="accHead" role="button" tabIndex={0} aria-expanded={open.has(g.key)}
              onClick={() => onToggle(g.key, false)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle(g.key, false))}>
              <span className="orb" style={{ color: g.color, background: `${g.color}12`, width: 36, height: 36 }}>{g.icon}</span>
              <div className="accTitle">
                <strong>{g.name}</strong>
                <small>{totalLabel(g, s.month_status)}: {formatINR(grp.total_paise)} · {pctLabel(grp.pct_of_income, s.income_paise)}</small>
              </div>
              <span className="chevron">⌄</span>
            </div>
            <div className="accBody">
              {g.key === 'loan' && (
                <>
                  {dash.loans.length === 0 && <div className="empty">No loans yet. Add one to track EMIs and balances.</div>}
                  {dash.loans.map((l) => <LoanRow key={l.id} loan={l} openModal={openModal} />)}
                  <div className="panelFoot"><button className="smallBtn" onClick={() => openModal('loan')}>＋ Add loan</button></div>
                  {txs.length > 0 && <div className="subHead">Payments this month</div>}
                </>
              )}
              {txs.map((t) => <TxRow key={t.id} t={t} color={g.color} total={grp.total_paise} openModal={openModal} />)}
              {g.key !== 'loan' && txs.length === 0 && <div className="empty">No entries for this month yet. Add a transaction to begin.</div>}
              <div className="panelFoot">
                {g.key !== 'loan' && (
                  <button className="smallBtn" onClick={() => openModal('transaction', { presetType: g.key === 'saving' ? 'saving' : 'expense', presetCategoryKey: g.key === 'misc' ? 'misc.dining' : g.key === 'necessary' ? 'necessary.groceries' : g.key })}>
                    ＋ Add {g.key === 'saving' ? 'saving' : 'expense'}
                  </button>
                )}
                {g.key === 'saving' && <span className="muted">Excel import for savings arrives in the next stage.</span>}
                {g.key === 'necessary' && (() => {
                  const fills = txs.filter((t) => t.category_key === 'necessary.fuel' && t.type === 'expense');
                  if (!fills.length) return null;
                  const litres = fills.reduce((a, t) => a + (t.litres_milli || 0), 0);
                  const avg = Math.round(fills.reduce((a, t) => a + t.amount_paise, 0) / fills.length);
                  return <span className="muted">Fuel: {fills.length} refuel{fills.length === 1 ? '' : 's'} · avg {formatINRExact(avg)}{litres ? ` · ${(litres / 1000).toFixed(1)} L` : ''}</span>;
                })()}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
