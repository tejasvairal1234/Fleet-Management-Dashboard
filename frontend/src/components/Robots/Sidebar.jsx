// components/Robots/Sidebar.jsx
import { useFleet } from "../../hooks/useFleet";
import { useRobotFilters } from "../../hooks/useRobotFilters";
import { STATUS_COLORS, STATUS_LABELS, needsAttention } from "../../utils/status";
import { formatBattery } from "../../utils/format";
import { useCallback, memo } from "react";

const FILTER_TABS = [
  { key: "all",       label: "All" },
  { key: "attention", label: "Attention" },
  { key: "working",   label: "Working" },
  { key: "idle",      label: "Idle" },
  { key: "charging",  label: "Charging" },
  { key: "offline",   label: "Offline" },
];

function getBatteryColor(battery) {
  if (battery < 15) return "#ef4444";
  if (battery < 30) return "#f59e0b";
  return "#10b981";
}

const RobotRow = memo(function RobotRow({ robot, selected, onSelect }) {
  const color   = STATUS_COLORS[robot.status] || "#6b7280";
  const attn    = needsAttention(robot);
  const battCol = getBatteryColor(robot.battery);
  const battPct = Math.min(100, Math.max(0, robot.battery));

  return (
    <div
      className={`robot-item ${selected ? "selected" : ""}`}
      onClick={() => onSelect(robot.robot_id)}
    >
      <div className="robot-item-top">
        <div>
          <span className="robot-id">{robot.robot_id}</span>
          {" "}
          <span className="robot-type">{(robot.robot_type || "").toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {attn && <span className="attn-badge">ATTN</span>}
          <span className="robot-status-label" style={{ color }}>
            {STATUS_LABELS[robot.status] || robot.status}
          </span>
        </div>
      </div>
      <div className="robot-item-bottom">
        <div className="battery-bar-wrap">
          <div
            className="battery-bar"
            style={{ width: `${battPct}%`, background: battCol }}
          />
        </div>
        <span className="battery-text" style={{ color: battCol }}>
          {formatBattery(robot.battery)}
        </span>
      </div>
    </div>
  );
});

export function Sidebar() {
  const {
    robots, selectedRobotId, searchTerm, filter,
    setSelectedRobot, setSearch, setFilter,
  } = useFleet();

  const { filteredRobots, filterCounts } = useRobotFilters(robots, filter, searchTerm);

  const handleSelect = useCallback((id) => {
    setSelectedRobot(id === selectedRobotId ? null : id);
  }, [selectedRobotId, setSelectedRobot]);

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search ID (r1) or type (picker)..."
            value={searchTerm}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-filters">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`filter-btn ${filter === tab.key ? "active" : ""}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            <span className="filter-count">{filterCounts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-showing">
        Showing {filteredRobots.length} of {robots.length} units
      </div>

      <div className="robot-list">
        {filteredRobots.map((robot) => (
          <RobotRow
            key={robot.robot_id}
            robot={robot}
            selected={robot.robot_id === selectedRobotId}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </aside>
  );
}
