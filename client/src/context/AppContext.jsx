import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { currentMonth } from '../utils/format.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [month, setMonth] = useState(currentMonth());
  const [version, setVersion] = useState(0); // bumped after every successful write → all views refetch
  const [toastMsg, setToastMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  // Another tab/window of this app saved changes → reload what we show.
  useEffect(() => {
    window.addEventListener('flowmoney:data-changed', refresh);
    return () => window.removeEventListener('flowmoney:data-changed', refresh);
  }, [refresh]);
  const toast = useCallback((message, kind = 'ok') => setToastMsg({ message, kind, id: Date.now() }), []);
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const value = useMemo(
    () => ({ month, setMonth, version, refresh, toast, toastMsg, modal, openModal, closeModal }),
    [month, version, refresh, toast, toastMsg, modal, openModal, closeModal],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
