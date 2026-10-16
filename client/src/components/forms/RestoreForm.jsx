import FormShell from './FormShell.jsx';
import { api } from '../../services/api.js';
import { backupFileName, saveTextFile } from '../../utils/saveFile.js';
import { ApiError } from '../../services/api.js';

const ROWS = [['transactions', 'Transactions'], ['loans', 'Loans'], ['salary_history', 'Salary records'], ['savings_accounts', 'Savings accounts'], ['savings_goals', 'Savings goals']];

export default function RestoreForm({ text, preview, filename }) {
  return (
    <FormShell
      title="Restore this backup?"
      description={`From “${filename}”${preview.exported_at ? `, exported ${new Date(preview.exported_at).toLocaleString('en-IN')}` : ''}.`}
      submitLabel="Replace my data"
      danger
      onSubmit={async () => {
        // Safety net: save a copy of what is on this device right now before replacing it.
        const current = await api.exportBackup();
        const saved = await saveTextFile(`before-restore-${backupFileName()}`, JSON.stringify(current));
        if (!saved) throw new ApiError('Restore cancelled: your current data was not backed up first, so nothing was changed.', 400);
        await api.restoreBackup(text);
        return 'Backup restored.';
      }}
    >
      <table className="txTable" style={{ margin: '10px 0' }}>
        <thead><tr><th>Records</th><th className="num">On this device now</th><th className="num">In the backup</th></tr></thead>
        <tbody>
          {ROWS.map(([k, label]) => (
            <tr key={k}><td>{label}</td><td className="num">{preview.current[k]}</td><td className="num">{preview.incoming[k]}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="muted">This <b>replaces everything</b> currently stored on this device. A copy of your current data is saved first, then the backup is applied all-or-nothing.</p>
    </FormShell>
  );
}
