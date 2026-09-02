import { useState, useEffect } from 'react';

export function Header({ connectionStatus, robotCount, lastUpdate, onAdminClick }) {
  const [timeAgoStr, setTimeAgoStr] = useState('just now');

  useEffect(() => {
    const updateTicker = () => {
      if (!lastUpdate) return;
      const diffMs = Date.now() - lastUpdate;
      if (diffMs < 1000) {
        setTimeAgoStr('0s ago');
      } else if (diffMs < 60000) {
        setTimeAgoStr(`${(diffMs / 1000).toFixed(1)}s ago`);
      } else {
        setTimeAgoStr(`${Math.floor(diffMs / 60000)}m ago`);
      }
    };

    updateTicker();
    const timer = setInterval(updateTicker, 500);
    return () => clearInterval(timer);
  }, [lastUpdate]);

  const statusMap = {
    live: { label: 'LIVE', cls: 'live' },
    reconnecting: { label: 'RECONNECTING...', cls: 'reconnecting' },
    disconnected: { label: 'DISCONNECTED', cls: 'disconnected' },
  };
  const { label, cls } = statusMap[connectionStatus] || statusMap.disconnected;

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-brand">
          <div className="header-logo-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              <circle cx="9" cy="12" r="1" fill="currentColor"/>
              <circle cx="15" cy="12" r="1" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <h1 className="header-title">Fleet Management Dashboard</h1>
            <span className="header-subtitle">Real-time Operations Control</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className={`connection-badge ${cls}`}>
          <span className="dot" />
          <span className="status-text">{label}</span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-stat-pill">
          <span className="stat-pill-num">{robotCount.toLocaleString()}</span>
          <span className="stat-pill-label">Robots</span>
        </div>

        <div className="header-meta-item">
          <span className="meta-label">Last update:</span>
          <span className="meta-value">{timeAgoStr}</span>
        </div>

        <button className="admin-btn" onClick={onAdminClick} title="Open admin runtime controls">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Admin
        </button>
      </div>
    </header>
  );
}
