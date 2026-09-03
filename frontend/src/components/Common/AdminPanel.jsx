// components/Common/AdminPanel.jsx
import { useState, useEffect, useRef } from "react";
import { useFleet } from "../../hooks/useFleet";
import { api } from "../../services/api";

export function AdminPanel() {
  const { closeAdminPanel } = useFleet();
  const [config, setConfig] = useState({ fleetSize: "", updateIntervalMs: "" });
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("adminApiKey") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConnectionError, setIsConnectionError] = useState(false);
  const [appliedConfig, setAppliedConfig] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    api.getSimulatorConfig()
      .then((cfg) => {
        setConfig({
          fleetSize: cfg.fleetSize !== undefined ? String(cfg.fleetSize) : "",
          updateIntervalMs: cfg.updateIntervalMs !== undefined ? String(cfg.updateIntervalMs) : "",
        });
      })
      .catch(() => {});

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleApply = async () => {
    setError("");
    setIsConnectionError(false);
    setAppliedConfig(null);

    const fleetSize = parseInt(config.fleetSize, 10);
    const updateIntervalMs = parseInt(config.updateIntervalMs, 10);

    if (isNaN(fleetSize) || isNaN(updateIntervalMs)) {
      setError("Please enter valid numbers for Fleet Size and Update Interval");
      return;
    }

    setLoading(true);

    try {
      const payload = { fleetSize, updateIntervalMs };
      const res = await api.updateSimulatorConfig(payload, adminKey);

      // Verify by reading current configuration from GET /api/simulator/config
      const verified = await api.getSimulatorConfig().catch(() => res.config || payload);

      const finalFleetSize = verified.fleetSize ?? payload.fleetSize;
      const finalInterval = verified.updateIntervalMs ?? payload.updateIntervalMs;

      // Save working admin key in session storage for operator convenience
      if (adminKey) {
        sessionStorage.setItem("adminApiKey", adminKey);
      }

      setAppliedConfig({
        fleetSize: finalFleetSize,
        updateIntervalMs: finalInterval,
      });

      // Automatically close modal after 3 seconds, or operator can click "Done" immediately
      closeTimerRef.current = setTimeout(() => {
        closeAdminPanel();
      }, 3000);
    } catch (err) {
      if (err.isConnectionError) {
        setIsConnectionError(true);
        setError("Unable to connect to simulator");
      } else {
        setIsConnectionError(false);
        setError(err.message || "Failed to apply configuration");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-overlay" onClick={(e) => e.target === e.currentTarget && closeAdminPanel()}>
      <div className="admin-panel">
        <div className="admin-panel-header">
          <span className="admin-panel-title">⚙ Simulator Configuration</span>
          <button className="close-btn" onClick={closeAdminPanel} title="Close">×</button>
        </div>

        {appliedConfig ? (
          <div className="admin-success-box">
            <div className="admin-success-title">✓ Configuration applied successfully</div>
            <div className="admin-success-details">
              <div className="admin-success-row">
                <span className="admin-success-label">Fleet Size:</span>
                <span className="admin-success-val">{appliedConfig.fleetSize}</span>
              </div>
              <div className="admin-success-row">
                <span className="admin-success-label">Update Interval:</span>
                <span className="admin-success-val">{appliedConfig.updateIntervalMs} ms</span>
              </div>
            </div>
            <div className="admin-success-restarting">Simulator restarting...</div>
            <div className="admin-actions" style={{ marginTop: "16px" }}>
              <button className="btn-primary" onClick={closeAdminPanel}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="admin-field">
              <label className="admin-label">Fleet Size</label>
              <input
                className="admin-input"
                type="number"
                min="1"
                max="2000"
                value={config.fleetSize}
                onChange={(e) => setConfig((c) => ({ ...c, fleetSize: e.target.value }))}
                placeholder="e.g. 8 or 100"
                disabled={loading}
              />
              <div className="admin-hint">Range: 1 – 2000 robots</div>
            </div>

            <div className="admin-field">
              <label className="admin-label">Update Interval (ms)</label>
              <input
                className="admin-input"
                type="number"
                min="100"
                max="60000"
                value={config.updateIntervalMs}
                onChange={(e) => setConfig((c) => ({ ...c, updateIntervalMs: e.target.value }))}
                placeholder="e.g. 1000"
                disabled={loading}
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
                placeholder="Enter admin API key..."
                disabled={loading}
              />
              <div className="admin-hint">Required to apply changes (configured in backend .env)</div>
            </div>

            {error && (
              isConnectionError ? (
                <div className="admin-error-box">
                  <div className="admin-error-title">✕ Unable to connect to simulator</div>
                  <button className="btn-retry" onClick={handleApply} disabled={loading}>
                    {loading ? "Retrying..." : "Try Again"}
                  </button>
                </div>
              ) : (
                <div className="admin-error-box">
                  <div className="admin-error-title">✕ Failed to apply configuration</div>
                  <div className="admin-error-msg">{error}</div>
                </div>
              )
            )}

            <div className="admin-actions">
              <button className="btn-secondary" onClick={closeAdminPanel} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleApply}
                disabled={loading || !config.fleetSize || !config.updateIntervalMs}
              >
                {loading ? "Applying..." : "Apply"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
