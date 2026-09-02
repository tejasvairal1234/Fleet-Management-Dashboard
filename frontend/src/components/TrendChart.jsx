import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

const TIME_WINDOWS = [
  { label: '1m',   ms: 60_000 },
  { label: '5m',   ms: 300_000 },
  { label: '15m',  ms: 900_000 },
  { label: '30m',  ms: 1_800_000 },
  { label: '1h',   ms: 3_600_000 },
];

const MAX_BUFFER = 2000;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const time = new Date(label);
  return (
    <div className="chart-tooltip">
      <div className="tooltip-time">{time.toLocaleTimeString()}</div>
      <div className="tooltip-val">
        <span className="tooltip-dot" />
        <strong>{payload[0].value?.toFixed(1)}%</strong> Active Fleet
      </div>
    </div>
  );
}

/**
 * TrendChart — sleek, compact collapsible bottom dock
 */
export function TrendChart({ stats, isCollapsed, onToggleCollapse }) {
  const [windowIdx, setWindowIdx] = useState(1); // default 5m
  const bufferRef = useRef([]);
  const [displayData, setDisplayData] = useState([]);

  useEffect(() => {
    if (stats.total === 0) return;
    const pct = (stats.working / stats.total) * 100;
    const point = { ts: Date.now(), value: parseFloat(pct.toFixed(2)) };

    bufferRef.current.push(point);
    if (bufferRef.current.length > MAX_BUFFER) {
      bufferRef.current = bufferRef.current.slice(-MAX_BUFFER);
    }

    const cutoff = Date.now() - TIME_WINDOWS[windowIdx].ms;
    setDisplayData(bufferRef.current.filter((p) => p.ts >= cutoff));
  }, [stats, windowIdx]);

  const handleWindowChange = useCallback((idx) => {
    setWindowIdx(idx);
    const cutoff = Date.now() - TIME_WINDOWS[idx].ms;
    setDisplayData(bufferRef.current.filter((p) => p.ts >= cutoff));
  }, []);

  const formatXAxis = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const currentPercent = stats.total > 0 ? ((stats.working / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <section className={`chart-dock${isCollapsed ? ' collapsed' : ''}`}>
      <div className="chart-dock-header">
        <div className="chart-dock-title-group">
          <span className="chart-title">Active Fleet %</span>
          <span className="chart-stat-badge">
            {currentPercent}% Working
          </span>
          <span className="chart-desc">
            (Working = Active + On Mission)
          </span>
        </div>

        <div className="chart-dock-controls">
          <div className="time-window-pill-group">
            {TIME_WINDOWS.map((tw, i) => (
              <button
                key={tw.label}
                type="button"
                className={`tw-btn${i === windowIdx ? ' active' : ''}`}
                onClick={() => handleWindowChange(i)}
              >
                {tw.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="chart-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Trend Chart' : 'Collapse Trend Chart'}
          >
            {isCollapsed ? '▲ Show Trend Chart' : '▼ Hide Chart'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="chart-dock-body">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 6, right: 16, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fleetAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(30, 58, 95, 0.4)" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatXAxis}
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(30, 58, 95, 0.6)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(30, 58, 95, 0.6)' }}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke="rgba(96, 165, 250, 0.25)" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#fleetAreaGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
