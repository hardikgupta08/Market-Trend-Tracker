import { useState } from "react";
import type { Instrument, Selection } from "../types";
import { pct, price, dir } from "../format";
import { Change } from "./Change";
import { Sparkline } from "./Sparkline";

type Period = "1d" | "1w" | "1m" | "ytd" | "1y";
const PERIODS: { id: Period; label: string; key: keyof Instrument }[] = [
  { id: "1d", label: "1D", key: "change_pct" },
  { id: "1w", label: "1W", key: "ret_1w" },
  { id: "1m", label: "1M", key: "ret_1m" },
  { id: "ytd", label: "YTD", key: "ret_ytd" },
  { id: "1y", label: "1Y", key: "ret_1y" },
];

function InstrumentList({
  items,
  period,
  onSelect,
}: {
  items: Instrument[];
  period: (typeof PERIODS)[number];
  onSelect: (s: Selection) => void;
}) {
  return (
    <ul className="inst-list">
      {items.map((i) => {
        const v = i[period.key] as number | null | undefined;
        return (
          <li key={i.symbol}>
            <button
              className="inst-row"
              onClick={() => onSelect({ symbol: i.symbol, name: i.name, kind: "index", currency: i.currency })}
            >
              <span className="inst-name" title={i.symbol}>{i.name}</span>
              <Sparkline values={i.spark} width={64} height={22} label={`${i.name} 90-day trend`} />
              <span className="inst-val">
                <span className="num">{price(i.price, i.currency)}</span>
                {period.id === "1d" ? (
                  <Change pctValue={i.change_pct} />
                ) : (
                  <span className={`chg ${dir(v)}`}>{pct(v)}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function IndexPanel({
  indices,
  macro,
  onSelect,
}: {
  indices: Instrument[];
  macro: Instrument[];
  onSelect: (s: Selection) => void;
}) {
  const [periodId, setPeriodId] = useState<Period>("1d");
  const period = PERIODS.find((p) => p.id === periodId)!;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Indices</h2>
        <div className="seg" role="tablist" aria-label="Return period">
          {PERIODS.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === periodId} onClick={() => setPeriodId(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>
      <InstrumentList items={indices} period={period} onSelect={onSelect} />
      <header className="panel-head sub">
        <h2>Currencies &amp; Commodities</h2>
      </header>
      <InstrumentList items={macro} period={period} onSelect={onSelect} />
    </section>
  );
}
