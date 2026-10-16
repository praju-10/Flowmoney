import { useApp } from '../../context/AppContext.jsx';
import { formatINR } from '../../utils/format.js';

export default function RightRail({ dash }) {
  const { openModal } = useApp();
  const name = dash?.profile.display_name || '';
  const goal = dash?.goal;
  return (
    <aside className="right">
      <div className="panel profile">
        <div className="avatar" aria-hidden="true">{(name || 'Y')[0].toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <strong>{name || 'Your profile'}</strong>
          <small>{dash?.profile.occupation || 'Personal finance'}</small>
        </div>
        <button className="smallBtn" aria-label="Edit profile" onClick={() => openModal('profile')}>⚙</button>
      </div>

      <div className="panel">
        <div className="panelTitle"><span>◎ &nbsp; Monthly goal</span><button className="smallBtn" onClick={() => openModal('goal')}>Edit</button></div>
        {goal && goal.target_paise > 0 ? (
          <>
            <div className="goalText"><span>Save this month</span><strong>{formatINR(goal.target_paise)}</strong></div>
            <div className="bar"><i style={{ width: `${goal.pct}%`, background: 'linear-gradient(90deg,#49d9c0,#6b9fff)' }} /></div>
            <div className="goalText"><span>{formatINR(Math.min(goal.saved_paise, goal.target_paise))} / {formatINR(goal.target_paise)}</span><span>{Math.round(goal.pct)}%</span></div>
          </>
        ) : <p className="muted">No savings goal yet. Set one to track your progress.</p>}
      </div>

      <div className="footnote">FLOWMONEY · PRIVATE BY DESIGN<br />Stored on this device only</div>
    </aside>
  );
}
