import { useState } from 'react';
import FormShell from './FormShell.jsx';
import Field from './Field.jsx';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { defaultDateFor, paiseToInput } from '../../utils/format.js';
import { TYPE_GROUPS, TYPE_LABEL } from '../../utils/categories.js';

export default function TransactionForm({ tx, presetType = 'expense', presetCategoryKey }) {
  const { month } = useApp();
  const { data: cats } = useAsync(() => api.categories(), []);
  const [type, setType] = useState(tx?.type || presetType);
  const editing = !!tx;
  const options = (cats || []).filter((c) => TYPE_GROUPS[type]?.includes(c.group_key) && (c.parent_id || !(cats || []).some((x) => x.parent_id === c.id)));
  const defaultCat = tx ? tx.category_id : (cats || []).find((c) => c.key === presetCategoryKey)?.id;
  const [catId, setCatId] = useState('');
  const chosen = catId || defaultCat || options[0]?.id || '';
  const isFuel = (cats || []).find((c) => String(c.id) === String(chosen))?.key === 'necessary.fuel';

  return (
    <FormShell
      title={editing ? 'Edit transaction' : 'Add transaction'}
      description="Keep your money picture up to date."
      submitLabel={editing ? 'Save changes' : 'Save'}
      onSubmit={async (fd) => {
        const body = {
          type, category_id: chosen, date: fd.get('date'), amount: fd.get('amount'),
          description: fd.get('description'), notes: fd.get('notes'), merchant: fd.get('merchant') || '',
        };
        if (isFuel) body.fuel = { litres_milli: fd.get('litres') || undefined, station: fd.get('station') || '' };
        if (editing) { await api.updateTransaction(tx.id, body); return 'Transaction updated.'; }
        await api.createTransaction(body); return 'Transaction saved on this device.';
      }}
    >
      {(err) => (
        <>
          <Field label="Type" error={err.type}>
            <select value={type} onChange={(e) => { setType(e.target.value); setCatId(''); }} disabled={editing && tx.loan_payment_kind}>
              {Object.keys(TYPE_GROUPS).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="What is it?" error={err.description}>
            <input name="description" defaultValue={tx?.description || ''} placeholder="e.g. Electricity bill" autoComplete="off" />
          </Field>
          <Field label="Amount (₹)" error={err.amount}>
            <input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={tx ? paiseToInput(tx.amount_paise) : ''} placeholder="2500" required />
          </Field>
          <Field label="Category" error={err.category_id}>
            <select value={chosen} onChange={(e) => setCatId(e.target.value)}>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Date" error={err.date}>
            <input name="date" type="date" defaultValue={tx?.date || defaultDateFor(month)} required />
          </Field>
          {isFuel && (
            <>
              <Field label="Litres (optional)"><input name="litres" type="number" min="0" step="0.001" defaultValue={tx?.litres_milli ? tx.litres_milli / 1000 : ''} /></Field>
              <Field label="Fuel station (optional)"><input name="station" defaultValue={tx?.station || ''} /></Field>
            </>
          )}
          <Field label="Merchant (optional)"><input name="merchant" defaultValue={tx?.merchant || ''} /></Field>
          <Field label="Note (optional)" error={err.notes}><input name="notes" defaultValue={tx?.notes || ''} placeholder="A little context" /></Field>
        </>
      )}
    </FormShell>
  );
}
