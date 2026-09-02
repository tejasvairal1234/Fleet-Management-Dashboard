import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export function AdminPanel({ onClose }) {
  const [step, setStep] = useState('auth'); // 'auth' | 'config'
  const [token, setToken] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [intervalMs, setIntervalMs] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);

  async function handleAuth(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError('Invalid admin token'); return; }
      const cfg = await res.json();
      setCurrentConfig(cfg);
      setFleetSize(String(cfg.fleetSize));
      setIntervalMs(String(cfg.updateIntervalMs));
      setStep('config');
    } catch {
      setError('Cannot reach backend');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);

    const body = {};
    if (fleetSize) body.fleetSize = parseInt(fleetSize, 10);
    if (intervalMs) body.updateIntervalMs = parseInt(intervalMs, 10);

    try {
      const res = await fetch(`${BACKEND_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(', ') || 'Update failed');
        return;
      }
      setCurrentConfig(data.config);
      setSuccess('Configuration updated! Simulator will pick up changes on next tick.');
    } catch {
      setError('Cannot reach backend');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {step === 'auth' ? (
          <>
            <div className="modal-title">⚙ Admin Controls</div>
            <div className="modal-subtitle">Enter your admin token to access fleet configuration.</div>
            <form onSubmit={handleAuth}>
              <div className="modal-field">
                <label className="modal-label">Admin Token</label>
                <input
                  type="password"
                  className="modal-input"
                  placeholder="Enter admin token..."
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <div className="modal-error">⚠ {error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !token}>
                  {loading ? 'Checking...' : 'Authenticate'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="modal-title">⚙ Fleet Configuration</div>
            <div className="modal-subtitle">
              Changes take effect immediately — no restart required.
            </div>
            {currentConfig && (
              <div style={{ fontSize: 11, color: '#4b6080', marginBottom: 16, fontFamily: 'JetBrains Mono, monospace' }}>
                Current: fleetSize={currentConfig.fleetSize} · interval={currentConfig.updateIntervalMs}ms · staleTimeout={currentConfig.staleTimeoutMs}ms
              </div>
            )}
            <form onSubmit={handleApply}>
              <div className="modal-field">
                <label className="modal-label">Fleet Size (1 – 10,000)</label>
                <input
                  type="number"
                  className="modal-input"
                  min={1} max={10000}
                  value={fleetSize}
                  onChange={e => setFleetSize(e.target.value)}
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Update Interval (100 – 60,000 ms)</label>
                <input
                  type="number"
                  className="modal-input"
                  min={100} max={60000}
                  value={intervalMs}
                  onChange={e => setIntervalMs(e.target.value)}
                />
              </div>
              {error && <div className="modal-error">⚠ {error}</div>}
              {success && <div className="modal-success">✓ {success}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Applying...' : 'Apply Changes'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
