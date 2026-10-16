import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';

export default function Toast() {
  const { toastMsg } = useApp();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toastMsg) return undefined;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), toastMsg.kind === 'error' ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);
  return (
    <div className={`toast ${visible ? 'show' : ''} ${toastMsg?.kind === 'error' ? 'toastError' : ''}`} role="status" aria-live="polite">
      {toastMsg?.message}
    </div>
  );
}
