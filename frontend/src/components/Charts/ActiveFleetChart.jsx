// components/Charts/ActiveFleetChart.jsx
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useFleet } from "../../hooks/useFleet";
import { computeKPIs } from "../../utils/status";

const WINDOWS = [
  { key: "1m",  label: "1m",  ms: 60 * 1000 },
  { key: "5m",  label: "5m",  ms: 5 * 60 * 1000 },
  { key: "15m", label: "15m", ms: 15 * 60 * 1000 },
  { key: "30m", label: "30m", ms: 30 * 60 * 1000 },
  { key: "1h",  label: "1h",  ms: 60 * 60 * 1000 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0b111d", border: "1px solid #1e293b",
      padding: "6px 10px", borderRadius: "6px",
      fontSize: "11px", color: "#e5e7eb",
    }}>
      <div style={{ color: "#94a3b8" }}>{label}</div>
      <div style={{ color: "#3b82f6", fontWeight: 700 }}>
        {payload[0].value?.toFixed(1)}% Working
      </div>
    </div>
  );
}

export function ActiveFleetChart() {
  const { trendData, chartWindow, showChart, robots, setChartWindow, toggleChart } = useFleet();

  // Filter by window
  const windowMs = WINDOWS.find((w) => w.key === chartWindow)?.ms || 5 * 60 * 1000;
  const now = Date.now();
  const chartData = useMemo(() => {
    return trendData
      .filter((p) => now - p.time <= windowMs)
      .map((p) => ({ ...p, time: undefined })); // recharts needs clean data
  }, [trendData, windowMs, now]);

  const kpis = useMemo(() => computeKPIs(robots), [robots]);
  const workingPct = kpis.total
    ? ((kpis.working / kpis.total) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="chart-area">
      <div className="chart-header">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="chart-title">Active Fleet %</span>
          <span className="chart-working-pct">{workingPct}% Working</span>
          <span style={{ fontSize: "10px", color: "#475569" }}>
            (Working = Active + On Mission)
          </span>
        </div>
        <div className="chart-controls">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              className={`chart-window-btn ${chartWindow === w.key ? "active" : ""}`}
              onClick={() => setChartWindow(w.key)}
            >
              {w.label}
            </button>
          ))}
          <button className="hide-chart-btn" onClick={toggleChart}>
            {showChart ? "▾ Hide Chart" : "▴ Show Chart"}
          </button>
        </div>
      </div>

      {showChart && (
        <div className="chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#475569", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#475569", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke="#1e293b" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "#3b82f6" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
