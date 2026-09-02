import { STATUS_COLORS, STATUS_LABELS, getBatteryColor, needsAttention } from '../utils/statusColors';

function timeAgo(updatedAt) {
  if (!updatedAt) return 'unknown';
  const diff = Date.now() - updatedAt;
  if (diff < 1000) return '0.5s ago';
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

export function RobotDetail({ robot, onClose, onFocusOnMap }) {
  if (!robot) return null;

  const color = STATUS_COLORS[robot.status] || '#64748b';
  const battColor = getBatteryColor(robot.battery);
  const isAttention = needsAttention(robot);

  return (
    <div className="robot-detail-hud">
      <div className="detail-hud-header">
        <div className="detail-title-group">
          <span className="detail-robot-dot" style={{ background: color }} />
          <div>
            <span className="detail-robot-id">{robot.robot_id}</span>
            <span className="detail-robot-type">{robot.robot_type || 'AMR'}</span>
          </div>
        </div>
        <div className="detail-header-actions">
          {onFocusOnMap && (
            <button
              type="button"
              className="hud-action-btn"
              onClick={() => onFocusOnMap(robot.x, robot.y)}
              title="Center map on this robot"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Focus
            </button>
          )}
          <button type="button" className="detail-close-btn" onClick={onClose} title="Close details">
            ×
          </button>
        </div>
      </div>

      <div
        className="detail-status-banner"
        style={{
          background: `${color}18`,
          color: color,
          borderColor: `${color}44`,
        }}
      >
        <span className="status-pulse-dot" style={{ background: color }} />
        <span>{STATUS_LABELS[robot.status] || robot.status}</span>
      </div>

      <div className="detail-metrics-grid">
        <div className="detail-metric-card">
          <span className="metric-lbl">Battery</span>
          <span className="metric-val" style={{ color: battColor }}>
            {robot.battery?.toFixed(1)}%
          </span>
          <div className="hud-battery-track">
            <div
              className="hud-battery-fill"
              style={{ width: `${Math.min(100, Math.max(0, robot.battery))}%`, background: battColor }}
            />
          </div>
        </div>

        <div className="detail-metric-card">
          <span className="metric-lbl">Coordinates (X, Y)</span>
          <span className="metric-val mono">
            {robot.x?.toFixed(1)}, {robot.y?.toFixed(1)}
          </span>
          <span className="metric-sub">Warehouse grid px</span>
        </div>

        <div className="detail-metric-card">
          <span className="metric-lbl">Last Heartbeat</span>
          <span className="metric-val">
            {timeAgo(robot.updatedAt)}
          </span>
          <span className="metric-sub">Sim t = {robot.t?.toFixed(0)}s</span>
        </div>

        <div className="detail-metric-card">
          <span className="metric-lbl">Connection State</span>
          <span className="metric-val" style={{ color: robot.isStale ? '#ef4444' : '#10b981' }}>
            {robot.isStale ? 'Stale / Offline' : 'Online / Active'}
          </span>
          <span className="metric-sub">{robot.isStale ? 'Timeout exceeded' : 'Healthy link'}</span>
        </div>
      </div>

      {isAttention && (
        <div className="hud-alert-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>
            <strong>Attention Required:</strong>{' '}
            {robot.status === 'error'
              ? 'Diagnostic fault reported'
              : robot.status === 'blocked'
              ? 'Obstacle path blocked'
              : robot.battery <= 20
              ? 'Critically low battery (<=20%)'
              : robot.isStale
              ? 'Heartbeat timeout'
              : 'Maintenance cycle required'}
          </div>
        </div>
      )}
    </div>
  );
}
