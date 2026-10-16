import { useState } from 'react';
import FormShell from './FormShell.jsx';
import Field from './Field.jsx';
import { api, ApiError } from '../../services/api.js';
import { backupFileName, saveTextFile } from '../../utils/saveFile.js';

export default function ResetForm() {
  const [typed, setTyped] = useState('');
  return (
    <FormShell
      title="Erase all FlowMoney data?"
      description="This permanently deletes your profile, salary history, transactions, loans and goals from this device."
      submitLabel="Erase everything"
      danger
      onSubmit={async () => {
        if (typed.trim() !== 'DELETE') throw new ApiError('Type DELETE (in capitals) to confirm.', 400, { confirm: 'Type DELETE (in capitals) to confirm.' });
        const saved = await saveTextFile(`before-erase-${backupFileName()}`, JSON.stringify(await api.exportBackup()));
        if (!saved) throw new ApiError('Erase cancelled: your data was not backed up first, so nothing was changed.', 400);
        await api.resetAll();
        return 'All data erased from this device.';
      }}
    >
      {(err) => (
        <>
          <p className="muted">A backup file is saved first so you can undo this. Other devices are not affected.</p>
          <Field label="Type DELETE to confirm" error={err.confirm}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </Field>
        </>
      )}
    </FormShell>
  );
}
