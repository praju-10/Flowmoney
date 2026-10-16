import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { api } from '../services/api.js';
import { requestPersistence, storageUsage } from '../data/browserDb.js';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../utils/install.js';
import { backupFileName, saveTextFile } from '../utils/saveFile.js';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

function InstallCard() {
  const [, bump] = useState(0);
  useEffect(() => onInstallChange(() => bump((n) => n + 1)), []);
  const { toast } = useApp();
  return (
    <div className="panel settingsBlock">
      <h3>Install on this device</h3>
      {isStandalone() ? (
        <p className="muted">FlowMoney is installed and running as an app on this device.</p>
      ) : canPromptInstall() ? (
        <>
          <p className="muted">Install FlowMoney to open it from your home screen, full screen, and use it offline.</p>
          <button className="primary" onClick={async () => { if (await promptInstall()) toast('FlowMoney installed.'); }}>Install FlowMoney</button>
        </>
      ) : isIOS() ? (
        <p className="muted">On iPhone/iPad: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>. Installing it also protects your data from Safari clearing site storage.</p>
      ) : (
        <p className="muted">Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { openModal, refresh, toast } = useApp();
  const fileRef = useRef(null);
  const info = useAsync(async () => ({ ...(await requestPersistence()), usage: await storageUsage() }), []);

  const demo = async (action) => {
    try { await (action === 'load' ? api.loadDemo() : api.clearDemo()); refresh(); toast(action === 'load' ? 'Demo data loaded (flagged as demo).' : 'Demo data removed. Your own records were not touched.'); }
    catch (e) { toast(e.message, 'error'); }
  };
  const exportNow = async () => {
    try {
      const data = await api.exportBackup();
      if (await saveTextFile(backupFileName(), JSON.stringify(data))) toast('Backup saved. Keep it private — it contains your financial data.');
    } catch (e) { toast(e.message, 'error'); }
  };
  const chooseFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('That file is too large to be a FlowMoney backup.');
      const text = await file.text();
      const preview = await api.previewBackup(text);
      openModal('restore', { text, preview, filename: file.name });
    } catch (err) { toast(err.message, 'error'); }
  };
  const usageKB = info.data?.usage ? Math.max(1, Math.round(info.data.usage / 1024)) : null;

  return (
    <>
      <header className="top"><div><div className="eyebrow">SETTINGS</div><h1>Settings</h1><div className="sub">Your profile, backups and where your data lives.</div></div></header>

      <div className="panel settingsBlock">
        <h3>Profile & salary</h3>
        <p className="muted">Name, role, monthly salary (with history) and savings goal.</p>
        <button className="secondary" onClick={() => openModal('profile')}>Edit profile</button>
      </div>

      <InstallCard />

      <div className="panel settingsBlock">
        <h3>Where your data is stored</h3>
        <p className="muted">Your records are stored <b>inside this browser, on this device</b> (an on-device SQLite database). They are never uploaded — the app has no server that receives your data. The website host only serves the app's code.</p>
        <p className="muted">
          Protected from automatic cleanup: <b>{info.loading ? '…' : info.data?.persisted ? 'Yes' : info.data?.supported ? 'Not yet — install the app to protect it' : 'Unknown on this browser'}</b>
          {usageKB != null && <> · Using about {usageKB.toLocaleString('en-IN')} KB</>}
        </p>
        <p className="muted"><b>Each device keeps its own data.</b> Your phone and your computer do not sync. To move data between them, export a backup on one and restore it on the other.</p>
      </div>

      <div className="panel settingsBlock">
        <h3>Backup & restore</h3>
        <p className="muted">A backup is a single file with all your records. Keep it somewhere private (it is not encrypted).</p>
        <div className="btnRow">
          <button className="primary" onClick={exportNow}>Export backup</button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={chooseFile} hidden />
      </div>

      <div className="panel settingsBlock">
        <h3>Demo data</h3>
        <p className="muted">Sample records are flagged and can be removed without touching your own data.</p>
        <div className="btnRow"><button className="secondary" onClick={() => demo('load')}>Load demo data</button><button className="secondary" onClick={() => demo('clear')}>Remove demo data</button></div>
      </div>

      <div className="panel settingsBlock">
        <h3>Erase everything</h3>
        <p className="muted">Deletes all data on this device. A backup file is saved first.</p>
        <button className="secondary danger" onClick={() => openModal('reset')}>Erase all data…</button>
      </div>
      <p className="muted">Not built yet: CSV export, category management, currency and theme options.</p>
    </>
  );
}
