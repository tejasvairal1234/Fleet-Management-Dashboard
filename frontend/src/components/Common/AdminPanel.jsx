// components/Common/AdminPanel.jsx
import { useState, useEffect } from "react";
import { useFleet } from "../../hooks/useFleet";
import { api } from "../../services/api";

export function AdminPanel() {
  const { closeAdminPanel } = useFleet();
  const [config, setConfig]     = useState({ fleetSize: "", updateIntervalMs: "" });
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  useEffect(() => {
    api.getSimulatorConfig()
      .then((cfg) => setConfig({ fleetSize: cfg.fleetSize, updateIntervalMs: cfg.updateIntervalMs }))
      .catch(() => {});
  }, []);

  const handleApply = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const payload = {
        fleetSize:        parseInt(config.fleetSize, 10),
        updateIntervalMs: parseInt(config.updateIntervalMs, 10),
      };
      if (isNaN(payload.fleetSize) || isNaN(payload.updateIntervalMs)) {
        setError("Please enter valid numbers"); setLoading(false); return;
      }
      await api.updateSimulatorConfig(payload, adminKey);
      setSuccess("Config applied! Simulator restarting...");
    } catch (e) {
      setError(e.message || "Failed to update config");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-overlay" onClick={(e) => e.target === e.currentTarget && closeAdminPanel()}>
      <div className="admin-panel">
        <div className="admin-panel-header">
          <span className="admin-panel-title">⚙ Simulator Configuration</span>
          <button className="close-btn" onClick={closeAdminPanel}>×</button>
        </div>

        <div className="admin-field">
          <label className="admin-label">Fleet Size</label>
          <input
            className="admin-input"
            type="number"
            min="1" max="2000"
            value={config.fleetSize}
            onChange={(e) => setConfig((c) => ({ ...c, fleetSize: e.target.value }))}
            placeholder="e.g. 200"
          />
          <div className="admin-hint">Range: 1 – 2000 robots</div>
        </div>

        <div className="admin-field">
          <label className="admin-label">Update Interval (ms)</label>
          <input
            className="admin-input"
            type="number"
            min="100" max="60000"
            value={config.updateIntervalMs}
            onChange={(e) => setConfig((c) => ({ ...c, updateIntervalMs: e.target.value }))}
            placeholder="e.g. 1000"
          />
          <div className="admin-hint">Range: 100ms – 60000ms</div>
        </div>

        <div className="admin-field admin-key-field">
          <label className="admin-label">Admin API Key</label>
          <input
            className="admin-input"
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter admin key..."
          />
          <div className="admin-hint">Required to apply changes (set in backend .env)</div>
        </div>

        {error   && <div className="admin-error">⚠ {error}</div>}
        {success && <div className="admin-success">✓ {success}</div>}

        <div className="admin-actions">
          <button className="btn-secondary" onClick={closeAdminPanel}>Cancel</button>
          <button className="btn-primary" onClick={handleApply} disabled={loading}>
            {loading ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
