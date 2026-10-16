import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import RightRail from './RightRail.jsx';
import BottomNav from './BottomNav.jsx';
import ModalHost from '../forms/ModalHost.jsx';
import Toast from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../services/api.js';

/** Three-column frame from the original design. One dashboard fetch feeds both the page and the right rail. */
export default function Shell() {
  const { month, version } = useApp();
  const { pathname } = useLocation();
  const dash = useAsync(() => api.dashboard(month), [month, version]);
  const home = pathname === '/';
  return (
    <div className={`app ${home ? '' : 'noRight'}`}>
      <Sidebar />
      <main className="main"><Outlet context={{ dash }} /></main>
      {home && <RightRail dash={dash.data} />}
      <BottomNav />
      <ModalHost />
      <Toast />
    </div>
  );
}
