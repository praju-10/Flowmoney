import { useState } from 'react';
import FormShell from './FormShell.jsx';
import Field from './Field.jsx';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { defaultDateFor, paiseToInput } from '../../utils/format.js';

export default function PaymentForm({ loan }) {
  const { month } = useApp();
  const [kind, setKind] = useState('emi');
  return (
    <FormShell
      title={`Record payment · ${loan.name}`}
      description="This creates one transaction, so it appears in your totals exactly once."
      onSubmit={async (fd) => {
        await api.recordPayment(loan.id, {
          kind, date: fd.get('date'), amount: fd.get('amount'), period: kind === 'emi' ? fd.get('period') : undefined,
          principal: fd.get('principal'), interest: fd.get('interest'), notes: fd.get('notes'),
        });
        return kind === 'emi' ? 'EMI recorded.' : 'Prepayment recorded.';
      }}
    >
      {(err) => (
        <>
          <Field label="Payment type">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="emi">EMI</option><option value="prepayment">Prepayment</option>
            </select>
          </Field>
          <Field label="Amount (₹)" error={err.amount}>
            <input name="amount" type="number" min="0.01" step="0.01" required defaultValue={kind === 'emi' ? paiseToInput(loan.emi_paise) : ''} key={kind} />
          </Field>
          <Field label="Date paid" error={err.date}><input name="date" type="date" defaultValue={defaultDateFor(month)} required /></Field>
          {kind === 'emi' && <Field label="EMI period" error={err.period} hint="The month this EMI settles. One EMI per loan per month."><input name="period" type="month" defaultValue={month} /></Field>}
          <Field label="Principal part (₹, optional)" error={err.principal} hint="Only enter this from your lender statement. We never guess the split."><input name="principal" type="number" min="0" step="0.01" /></Field>
          <Field label="Interest part (₹, optional)" error={err.interest}><input name="interest" type="number" min="0" step="0.01" /></Field>
          <Field label="Note (optional)"><input name="notes" /></Field>
        </>
      )}
    </FormShell>
  );
}
