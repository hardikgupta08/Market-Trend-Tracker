import type { Instrument, Selection } from "../types";
import { price } from "../format";
import { Change } from "./Change";

export function TickerTape({ items, onSelect }: { items: Instrument[]; onSelect: (s: Selection) => void }) {
  if (!items.length) return <div className="tape" />;
  const row = items.map((i) => (
    <button
      key={i.symbol}
      className="tape-item"
      onClick={() => onSelect({ symbol: i.symbol, name: i.name, kind: "index", currency: i.currency })}
    >
      <span className="tape-name">{i.name}</span>
      <span className="num">{price(i.price, i.currency)}</span>
      <Change pctValue={i.change_pct} />
    </button>
  ));
  return (
    <div className="tape" aria-label="Index ticker">
      <div className="tape-track">
        <div className="tape-row">{row}</div>
        <div className="tape-row" aria-hidden>{row}</div>
      </div>
    </div>
  );
}
