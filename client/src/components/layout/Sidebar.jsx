import { useLocation, useNavigate } from 'react-router-dom';

export const NAV = [
  { path: '/', label: 'Home', icon: '⌂' },
  { path: '/transactions', label: 'Transactions', icon: '▤' },
  { path: '/reports', label: 'Reports', icon: '⌁' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <aside className="side">
      <div className="brand"><span className="logo">◈</span> FlowMoney</div>
      <span className="phoneOnly privChip">♧ On this device</span>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.path} className={pathname === n.path ? 'active' : ''} aria-current={pathname === n.path ? 'page' : undefined} onClick={() => navigate(n.path)}>
            {n.icon} &nbsp; {n.label}
          </button>
        ))}
      </nav>
      <div className="mountains" aria-hidden="true">
        <svg viewBox="0 0 160 70" preserveAspectRatio="none">
          <path d="M0 70 L0 48 L28 24 L46 40 L74 12 L104 44 L128 30 L160 54 L160 70Z" fill="#14234a" />
          <path d="M0 70 L0 58 L34 40 L62 56 L96 34 L130 58 L160 46 L160 70Z" fill="#1a2c5c" opacity=".8" />
        </svg>
      </div>
      <div className="privacy">♧ &nbsp; Your data stays on this device<br /><span style={{ paddingLeft: 21 }}>Local-first · Private by design</span></div>
    </aside>
  );
}
