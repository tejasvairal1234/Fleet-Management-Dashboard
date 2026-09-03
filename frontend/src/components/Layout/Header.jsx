// components/Layout/Header.jsx
import { useFleet } from "../../hooks/useFleet";
import { formatTimeAgo } from "../../utils/format";
import { useEffect, useState } from "react";

export function Header() {
  const { robots, connectionStatus, openAdminPanel, lastUpdateRef } = useFleet();
  const [lastUpdate, setLastUpdate] = useState("Never");

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastUpdateRef.current) {
        const sec = Math.floor((Date.now() - lastUpdateRef.current) / 1000);
        setLastUpdate(`${sec}s ago`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdateRef]);

  const connLabel = {
    connected:    "LIVE",
    reconnecting: "RECONNECTING",
    offline:      "OFFLINE",
  }[connectionStatus] || "OFFLINE";

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-title">Fleet Management Dashboard</div>
        <div className="header-sub">Real-Time Operations Control</div>
      </div>

      <div className="header-center">
        <div className={`connection-badge ${connectionStatus}`}>
          <span className="connection-dot" />
          {connLabel}
        </div>
      </div>

      <div className="header-right">
        <div className="header-stats">
          <div className="header-robot-count">{robots.length} Robots</div>
          <div className="header-last-update">Last update: {lastUpdate}</div>
        </div>
        <button className="admin-btn" onClick={openAdminPanel}>
          <span className="admin-icon">⚙</span>
          Admin
        </button>
      </div>
    </header>
  );
}
