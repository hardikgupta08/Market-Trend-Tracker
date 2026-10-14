import { useState } from "react";
import type { SectorSummary } from "../types";
import { dir, marketCap, pct, price } from "../format";

type Metric = "weighted" | "average" | "index";

function value(s: SectorSummary, m: Metric) {
  if (m === "weighted") return s.weighted_change_pct;
  if (m === "average") return s.avg_change_pct;
  return s.index?.change_pct ?? null;
}

/** Diverging tile fill: intensity scales with |change|, gray at zero. */
function intensity(v: number | null) {
  if (v == null) return 0;
  return Math.min(1, Math.abs(v) / 3);
}

export function SectorHeatmap({
  sectors,
  currency,
  selected,
  onSelect,
}: {
  sectors: SectorSummary[];
  currency: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [metric, setMetric] = useState<Metric>("weighted");
  const sorted = [...sectors].sort((a, b) => (value(b, metric) ?? -99) - (value(a, metric) ?? -99));

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Sectors</h2>
        <div className="seg" role="tablist" aria-label="Heatmap metric">
          {(
            [
              ["weighted", "Mcap-weighted"],
              ["average", "Equal-weight"],
              ["index", "Sector index"],
            ] as [Metric, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={metric === id} onClick={() => setMetric(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="heatmap">
        {sorted.map((s) => {
          const v = value(s, metric);
          const d = dir(v);
          const total = s.advances + s.declines + s.unchanged || 1;
          return (
            <button
              key={s.id}
              className={`tile ${d} ${selected === s.id ? "selected" : ""}`}
              style={{ ["--k" as string]: intensity(v) }}
              onClick={() => onSelect(s.id)}
              title={`${s.name}: ${s.advances} advancing, ${s.declines} declining`}
            >
              <div className="tile-top">
                <span className="tile-name">{s.name}</span>
                <span className="tile-chg num">{pct(v)}</span>
              </div>
              <div className="tile-meta">
                {s.index ? (
                  <span>
                    {s.index.name ?? s.index_symbol} {price(s.index.price, currency)}
                  </span>
                ) : (
                  <span>{s.count} stocks</span>
                )}
                <span>{marketCap(s.total_market_cap, currency)}</span>
              </div>
              <div className="breadth-mini" aria-label={`${s.advances} up, ${s.declines} down`}>
                <span className="b-up" style={{ width: `${(s.advances / total) * 100}%` }} />
                <span className="b-flat" style={{ width: `${(s.unchanged / total) * 100}%` }} />
                <span className="b-down" style={{ width: `${(s.declines / total) * 100}%` }} />
              </div>
              <div className="tile-ad">
                <span>▲ {s.advances}</span>
                <span>▼ {s.declines}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
