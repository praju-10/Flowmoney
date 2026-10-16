import { useLocation, useNavigate } from 'react-router-dom';
import { NAV } from './Sidebar.jsx';
import { useApp } from '../../context/AppContext.jsx';

/** Phone-only: bottom tab bar + floating "add" button. Hidden by CSS on every other screen size. */
export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { openModal } = useApp();
  return (
    <>
      <nav className="bottomNav" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.path} className={pathname === n.path ? 'active' : ''} aria-current={pathname === n.path ? 'page' : undefined} onClick={() => navigate(n.path)}>
            <span className="ico" aria-hidden="true">{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </nav>
      {(pathname === '/' || pathname === '/transactions') && (
        <button className="fab" aria-label="Add transaction" onClick={() => openModal('transaction')}>＋</button>
      )}
    </>
  );
}
