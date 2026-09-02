import { useMemo } from 'react';
import { STATUS_COLORS, STATUS_LABELS, getBatteryColor, needsAttention } from '../utils/statusColors';

export function RobotList({
  robots,
  selectedId,
  searchQuery,
  statusFilter,
  onSearch,
  onFilter,
  onSelect
}) {
  const robotsArray = useMemo(() => Array.from(robots.values()), [robots]);

  // Compute counts for filter pills
  const filterCounts = useMemo(() => {
    let attention = 0, working = 0, idle = 0, charging = 0, offline = 0;
    for (const r of robotsArray) {
      if (needsAttention(r)) attention++;
      if (r.status === 'active' || r.status === 'on_mission') working++;
      if (r.status === 'idle') idle++;
      if (r.status === 'charging') charging++;
      if (r.status === 'offline') offline++;
    }
    return {
      all: robotsArray.length,
      attention,
      working,
      idle,
      charging,
      offline,
    };
  }, [robotsArray]);

  const filterOptions = [
    { key: null, label: 'All', count: filterCounts.all },
    { key: 'attention', label: 'Attention', count: filterCounts.attention, isAlert: filterCounts.attention > 0 },
    { key: 'working', label: 'Working', count: filterCounts.working },
    { key: 'idle', label: 'Idle', count: filterCounts.idle },
    { key: 'charging', label: 'Charging', count: filterCounts.charging },
    { key: 'offline', label: 'Offline', count: filterCounts.offline },
  ];

  // Filter and sort robots
  const query = (searchQuery || '').trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = robotsArray.filter((r) => {
      const matchesSearch =
        !query ||
        r.robot_id.toLowerCase().includes(query) ||
        (r.robot_type || '').toLowerCase().includes(query);

      let matchesFilter = true;
      if (statusFilter === 'attention') matchesFilter = needsAttention(r);
      else if (statusFilter === 'working') matchesFilter = r.status === 'active' || r.status === 'on_mission';
      else if (statusFilter === 'idle') matchesFilter = r.status === 'idle';
      else if (statusFilter === 'charging') matchesFilter = r.status === 'charging';
      else if (statusFilter === 'offline') matchesFilter = r.status === 'offline';

      return matchesSearch && matchesFilter;
    });

    // Sort: Attention units first, then by numerical/alphabetical robot_id
    list.sort((a, b) => {
      const aAttn = needsAttention(a) ? 0 : 1;
      const bAttn = needsAttention(b) ? 0 : 1;
      if (aAttn !== bAttn) return aAttn - bAttn;
      return a.robot_id.localeCompare(b.robot_id, undefined, { numeric: true });
    });

    return list;
  }, [robotsArray, query, statusFilter]);

  return (
    <aside className="sidebar">
      {/* Search Header */}
      <div className="sidebar-search-container">
        <div className="search-wrapper">
          <span className="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            type="text"
            className="search-input"
            placeholder="Search ID (r1) or type (picker)..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearch('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="sidebar-filter-tabs">
        {filterOptions.map(({ key, label, count, isAlert }) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={String(key)}
              type="button"
              className={`filter-chip${isActive ? ' active' : ''}${isAlert ? ' alert-chip' : ''}`}
              onClick={() => onFilter(key)}
            >
              <span>{label}</span>
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Robot List Header / Summary */}
      <div className="sidebar-list-meta">
        <span>Showing {filtered.length} of {robotsArray.length} units</span>
        {statusFilter && (
          <button type="button" className="clear-filter-link" onClick={() => onFilter(null)}>
            Reset filter
          </button>
        )}
      </div>

      {/* Robot List */}
      <div className="robot-list-viewport">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>No matching robots found</span>
          </div>
        ) : (
          <div className="robot-items-container">
            {filtered.slice(0, 300).map((robot) => {
              const isSelected = selectedId === robot.robot_id;
              const isAttn = needsAttention(robot);
              const color = STATUS_COLORS[robot.status] || '#64748b';
              const battColor = getBatteryColor(robot.battery);

              return (
                <div
                  key={robot.robot_id}
                  className={`robot-card${isSelected ? ' selected' : ''}${isAttn ? ' has-attention' : ''}`}
                  onClick={() => onSelect(robot.robot_id)}
                >
                  <div className="robot-card-top">
                    <div className="robot-id-wrap">
                      <span className="robot-status-dot" style={{ background: color }} />
                      <span className="robot-id">{robot.robot_id}</span>
                      <span className="robot-type-tag">{robot.robot_type || 'AMR'}</span>
                    </div>

                    {isAttn && (
                      <span className="attn-badge" title="Needs attention">
                        {robot.status === 'error' ? 'ERR' : robot.battery <= 20 ? 'BAT' : 'ATTN'}
                      </span>
                    )}
                  </div>

                  <div className="robot-card-bottom">
                    <div className="robot-status-text" style={{ color }}>
                      {STATUS_LABELS[robot.status] || robot.status}
                    </div>

                    <div className="robot-battery-wrap">
                      <div className="battery-mini-track">
                        <div
                          className="battery-mini-bar"
                          style={{
                            width: `${Math.min(100, Math.max(0, robot.battery))}%`,
                            background: battColor,
                          }}
                        />
                      </div>
                      <span className="battery-mini-val" style={{ color: battColor }}>
                        {robot.battery?.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length > 300 && (
              <div className="list-overflow-notice">
                + {filtered.length - 300} more robots (refine search above)
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
