// components/Stats/KpiCards.jsx
import { useMemo } from "react";
import { useFleet } from "../../hooks/useFleet";
import { computeKPIs } from "../../utils/status";

const CARDS = [
  { key: "total",    label: "Total Fleet",   color: "#94a3b8", dot: "#94a3b8" },
  { key: "working",  label: "Working",       color: "#3b82f6", dot: "#3b82f6" },
  { key: "idle",     label: "Idle",          color: "#6b7280", dot: "#6b7280" },
  { key: "charging", label: "Charging",      color: "#8b5cf6", dot: "#8b5cf6" },
  { key: "attention",label: "Attention",     color: "#f59e0b", dot: "#f59e0b" },
  { key: "offline",  label: "Offline",       color: "#ef4444", dot: "#ef4444" },
];

export function KpiCards() {
  const { robots } = useFleet();
  const kpis = useMemo(() => computeKPIs(robots), [robots]);
  const total = kpis.total || 1;

  const values = {
    total:     kpis.total,
    working:   kpis.working,
    idle:      kpis.idle,
    charging:  kpis.charging,
    attention: kpis.attention,
    offline:   kpis.offline,
  };

  return (
    <div className="kpi-bar">
      {CARDS.map((card) => {
        const val = values[card.key];
        const pct = card.key !== "total" ? ((val / total) * 100).toFixed(0) : null;
        return (
          <div className="kpi-card" key={card.key}>
            <div className="kpi-label" style={{ color: card.color }}>
              <span className="kpi-dot" style={{ background: card.dot }} />
              {card.label}
            </div>
            <div className="kpi-value" style={{ color: card.color }}>{val}</div>
            {pct !== null && (
              <div className="kpi-pct">{pct}%</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
