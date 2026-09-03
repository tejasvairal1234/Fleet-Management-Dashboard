import { useState, useEffect } from "react";
import { useFleet } from "../../hooks/useFleet";
import { STATUS_COLORS, STATUS_LABELS, needsAttention } from "../../utils/status";
import { formatBattery, formatCoords, formatTimeAgo, formatRobotType } from "../../utils/format";

function getBatteryColor(b) {
  if (b < 15) return "#ef4444";
  if (b < 30) return "#f59e0b";
  return "#10b981";
}

export function RobotDetailPanel({ onFocus }) {
  const { robots, selectedRobotId, setSelectedRobot, focusRobot, focusedRobotId } = useFleet();
  const [justFocused, setJustFocused] = useState(false);

  // Reset justFocused if selected robot changes
  useEffect(() => {
    setJustFocused(false);
  }, [selectedRobotId]);

  if (!selectedRobotId) return null;

  const robot = robots.find((r) => r.robot_id === selectedRobotId);
  if (!robot) return null;

  const handleFocusClick = () => {
    focusRobot(robot.robot_id);
    onFocus?.(robot.robot_id);
    setJustFocused(true);
    setTimeout(() => {
      setJustFocused(false);
    }, 2000);
  };

  const statusColor = STATUS_COLORS[robot.status] || "#6b7280";
  const battColor   = getBatteryColor(robot.battery);
  const attn        = needsAttention(robot);
  const isOffline   = robot.status === "offline";
  const battPct     = Math.min(100, Math.max(0, robot.battery));

  const connState = isOffline ? "Stale / Offline" : "Live";
  const heartbeat = robot.last_seen ? formatTimeAgo(robot.last_seen) : "Unknown";
  const isCurrentlyFocused = focusedRobotId === robot.robot_id;

  return (
    <div className="robot-detail-panel">
      <div className="detail-header">
        <div className="detail-robot-info">
          <div className="detail-robot-id">{robot.robot_id}</div>
          <div className="detail-robot-type">{formatRobotType(robot.robot_type)}</div>
        </div>
        <div className="detail-actions">
          <button
            className={`focus-btn ${justFocused ? "focused" : ""}`}
            onClick={handleFocusClick}
            title={`Focus map on ${robot.robot_id}`}
          >
            {justFocused ? "✓ Focused" : "◎ Focus"}
          </button>
          <button className="close-btn" onClick={() => setSelectedRobot(null)} title="Deselect">×</button>
        </div>
      </div>

      {(justFocused || isCurrentlyFocused) && (
        <div className="detail-focused-banner">
          ✓ Focused on {robot.robot_id}
        </div>
      )}

      <div
        className="detail-status-badge"
        style={{
          background: `${statusColor}22`,
          borderColor: `${statusColor}66`,
          color: statusColor,
        }}
      >
        {STATUS_LABELS[robot.status] || robot.status}
      </div>

      <div className="detail-body">
        {/* Battery */}
        <div className="battery-display">
          <div className="battery-pct-row">
            <span className="detail-field-label">Battery</span>
            <span className="battery-big" style={{ color: battColor }}>
              {formatBattery(robot.battery)}
            </span>
          </div>
          <div className="battery-bar-detail">
            <div
              className="battery-fill"
              style={{ width: `${battPct}%`, background: battColor }}
            />
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-field">
            <span className="detail-field-label">Coordinates</span>
            <span className="detail-field-value">{formatCoords(robot.x, robot.y)}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Last Heartbeat</span>
            <span className="detail-field-value">{heartbeat}</span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-field">
            <span className="detail-field-label">Connection State</span>
            <span
              className="detail-field-value"
              style={{ color: isOffline ? "#ef4444" : "#10b981" }}
            >
              {connState}
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Sim t</span>
            <span className="detail-field-value">{robot.t ?? "—"}</span>
          </div>
        </div>
      </div>

      {attn && (
        <div className="attention-alert">
          ⚠ Attention Required:{" "}
          {robot.status === "offline"
            ? "Heartbeat timeout"
            : robot.battery < 20
            ? "Low battery"
            : robot.status === "error"
            ? "Error state"
            : robot.status === "blocked"
            ? "Robot blocked"
            : "Requires attention"}
        </div>
      )}
    </div>
  );
}
