import FormShell from './FormShell.jsx';
import Field from './Field.jsx';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { paiseToInput } from '../../utils/format.js';

// mode: 'profile' (name, role, salary, goal) | 'goal' (monthly savings goal only)
export default function ProfileForm({ mode = 'profile' }) {
  const { month } = useApp();
  const { data: p, loading } = useAsync(() => api.profile(month), []);
  if (loading || !p) return <FormShell title="Loading…" onSubmit={async () => {}}><p className="muted">One moment…</p></FormShell>;
  const goalOnly = mode === 'goal';
  return (
    <FormShell
      title={goalOnly ? 'Monthly savings goal' : 'Your profile'}
      description={goalOnly ? 'Choose the savings target you want to work towards.' : 'These details are stored only on this computer.'}
      onSubmit={async (fd) => {
        await api.saveProfile({
          display_name: goalOnly ? p.display_name || 'You' : fd.get('display_name'),
          occupation: goalOnly ? p.occupation : fd.get('occupation'),
          email: p.email || '', phone: p.phone || '', currency: p.currency,
          savings_goal: fd.get('savings_goal'),
        });
        if (!goalOnly && fd.get('salary') !== '' && Math.round(Number(fd.get('salary')) * 100) !== p.salary_paise) {
          await api.saveSalary({ amount: fd.get('salary'), effective_from: fd.get('effective_from') });
        }
        return goalOnly ? 'Savings goal updated.' : 'Profile updated.';
      }}
    >
      {(err) => (
        <>
          {!goalOnly && (
            <>
              <Field label="Name" error={err.display_name}><input name="display_name" defaultValue={p.display_name} required /></Field>
              <Field label="Role / description" error={err.occupation}><input name="occupation" defaultValue={p.occupation} /></Field>
              <Field label="Monthly take-home salary (₹)" error={err.amount}><input name="salary" type="number" min="0" step="0.01" defaultValue={paiseToInput(p.salary_paise)} /></Field>
              <Field label="Salary applies from" error={err.effective_from} hint="Earlier months keep their previous salary — history is never rewritten.">
                <input name="effective_from" type="date" defaultValue={`${month}-01`} />
              </Field>
            </>
          )}
          <Field label="Monthly savings goal (₹)" error={err.savings_goal}><input name="savings_goal" type="number" min="0" step="0.01" defaultValue={paiseToInput(p.savings_goal_paise)} required /></Field>
        </>
      )}
    </FormShell>
  );
}
