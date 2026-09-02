export function StatsBar({ stats, activeFilter, onFilter }) {
  const cards = [
    {
      key: 'total',
      label: 'Total Fleet',
      value: stats.total,
      cls: 'total',
      dotColor: '#3b82f6',
      desc: 'All connected units'
    },
    {
      key: 'working',
      label: 'Working',
      value: stats.working,
      cls: 'working',
      dotColor: '#10b981',
      desc: 'Active & On Mission'
    },
    {
      key: 'idle',
      label: 'Idle',
      value: stats.idle,
      cls: 'idle',
      dotColor: '#64748b',
      desc: 'Standby / Ready'
    },
    {
      key: 'charging',
      label: 'Charging',
      value: stats.charging,
      cls: 'charging',
      dotColor: '#8b5cf6',
      desc: 'Docked at power station'
    },
    {
      key: 'attention',
      label: 'Attention',
      value: stats.attention,
      cls: 'attention',
      dotColor: '#ef4444',
      desc: 'Errors, blocked, low battery'
    },
    {
      key: 'offline',
      label: 'Offline',
      value: stats.offline,
      cls: 'offline',
      dotColor: '#374151',
      desc: 'Stale / Disconnected'
    },
  ];

  return (
    <div className="stats-bar">
      {cards.map(({ key, label, value, cls, dotColor, desc }) => {
        const isSelected = activeFilter === key;
        return (
          <button
            key={key}
            type="button"
            className={`stat-card ${cls}${isSelected ? ' active' : ''}`}
            onClick={() => onFilter(isSelected ? null : key)}
            title={`${label}: ${desc} (Click to filter)`}
          >
            <div className="stat-card-header">
              <span className="stat-indicator-dot" style={{ background: dotColor }} />
              <span className="stat-label">{label}</span>
              {isSelected && <span className="stat-active-pill">Filter</span>}
            </div>
            <div className="stat-value-row">
              <span className="stat-value">{value}</span>
              {stats.total > 0 && key !== 'total' && (
                <span className="stat-percent">
                  {Math.round((value / stats.total) * 100)}%
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
