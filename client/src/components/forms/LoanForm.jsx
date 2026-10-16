import FormShell from './FormShell.jsx';
import Field from './Field.jsx';
import { api } from '../../services/api.js';
import { paiseToInput } from '../../utils/format.js';

export default function LoanForm({ loan }) {
  const editing = !!loan;
  return (
    <FormShell
      title={editing ? 'Edit loan' : 'Add a loan'}
      description="Only the name and EMI are required. Add the rest if you know it."
      onSubmit={async (fd) => {
        const body = Object.fromEntries(fd.entries());
        if (editing) { await api.updateLoan(loan.id, body); return 'Loan updated.'; }
        await api.createLoan(body); return 'Loan added.';
      }}
    >
      {(err) => (
        <>
          <Field label="Loan name" error={err.name}><input name="name" defaultValue={loan?.name || ''} required placeholder="Home Loan" /></Field>
          <Field label="Lender / bank" error={err.lender}><input name="lender" defaultValue={loan?.lender || ''} /></Field>
          <Field label="Type" error={err.kind}>
            <select name="kind" defaultValue={loan?.kind || 'other'}>
              {['home', 'car', 'personal', 'education', 'other'].map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Monthly EMI (₹)" error={err.emi}><input name="emi" type="number" min="0.01" step="0.01" defaultValue={loan ? paiseToInput(loan.emi_paise) : ''} required /></Field>
          <Field label="Due day of month (optional)" error={err.due_day}><input name="due_day" type="number" min="1" max="31" defaultValue={loan?.due_day ?? ''} /></Field>
          <Field label="Original principal (₹, optional)" error={err.original_principal}><input name="original_principal" type="number" min="0" step="0.01" defaultValue={paiseToInput(loan?.original_principal_paise)} /></Field>
          <Field label="Outstanding principal (₹, optional)" error={err.outstanding} hint="Progress is only shown when both principal figures are entered."><input name="outstanding" type="number" min="0" step="0.01" defaultValue={paiseToInput(loan?.outstanding_paise)} /></Field>
          <Field label="Interest rate % p.a. (optional)" error={err.interest_rate}><input name="interest_rate" type="number" min="0" max="100" step="0.01" defaultValue={loan?.interest_rate_bps != null ? loan.interest_rate_bps / 100 : ''} /></Field>
          <Field label="Start date (optional)" error={err.start_date}><input name="start_date" type="date" defaultValue={loan?.start_date || ''} /></Field>
          <Field label="Expected end date (optional)" error={err.end_date}><input name="end_date" type="date" defaultValue={loan?.end_date || ''} /></Field>
          <Field label="Notes (optional)" error={err.notes}><input name="notes" defaultValue={loan?.notes || ''} /></Field>
        </>
      )}
    </FormShell>
  );
}
