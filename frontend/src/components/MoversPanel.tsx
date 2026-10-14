import { useState } from "react";
import type { Overview, Selection } from "../types";
import { marketCap, pct, price, ticker, volume } from "../format";
import { Change } from "./Change";

type Tab = "gainers" | "losers" | "active" | "near_high";
const TABS: [Tab, string][] = [
  ["gainers", "Gainers"],
  ["losers", "Losers"],
  ["active", "Most active"],
  ["near_high", "Near 52W high"],
];

export function MoversPanel({
  overview,
  sectorNames,
  onSelect,
}: {
  overview: Overview;
  sectorNames: Record<string, string>;
  onSelect: (s: Selection) => void;
}) {
  const [tab, setTab] = useState<Tab>("gainers");
  const { breadth, currency } = overview;
  const total = breadth.total || 1;
  const flat = breadth.total - breadth.advances - breadth.declines;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Market Breadth</h2>
        <span className="muted small">{breadth.total} stocks tracked</span>
      </header>
      <div className="breadth">
        <div className="breadth-bar" role="img" aria-label={`${breadth.advances} advancing, ${breadth.declines} declining`}>
          <span className="b-up" style={{ width: `${(breadth.advances / total) * 100}%` }} />
          <span className="b-flat" style={{ width: `${(flat / total) * 100}%` }} />
          <span className="b-down" style={{ width: `${(breadth.declines / total) * 100}%` }} />
        </div>
        <div className="breadth-legend">
          <span className="chg up">▲ {breadth.advances} advancing</span>
          <span className="muted">{flat} flat</span>
          <span className="chg down">▼ {breadth.declines} declining</span>
        </div>
      </div>

      <header className="panel-head sub">
        <div className="seg wide" role="tablist" aria-label="Movers">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <ul className="movers">
        {overview.movers[tab].map((m) => (
          <li key={m.symbol}>
            <button className="mover" onClick={() => onSelect({ symbol: m.symbol, name: m.name, kind: "stock", currency })}>
              <span className="mover-id">
                <span className="sym">{ticker(m.symbol)}</span>
                <span className="cname">{m.name} · {sectorNames[m.sector] ?? m.sector}</span>
              </span>
              <span className="mover-val">
                <span className="num">{price(m.price, currency)}</span>
                {tab === "active" ? (
                  <span className="muted small">{volume(m.volume)} vol</span>
                ) : tab === "near_high" ? (
                  <span className="muted small">{marketCap(m.market_cap, currency)}</span>
                ) : null}
              </span>
              <Change pctValue={m.change_pct} />
            </button>
          </li>
        ))}
        {!overview.movers[tab].length && <li className="empty">No data — {pct(null)}</li>}
      </ul>
    </section>
  );
}
