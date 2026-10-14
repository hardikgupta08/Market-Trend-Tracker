import { useMemo, useState } from "react";
import type { Quote, SectorDetail, Selection } from "../types";
import { dir, marketCap, pct, price, ratio, rating, ticker, volume } from "../format";
import { Change } from "./Change";

type Key = "rank" | "name" | "price" | "change_pct" | "market_cap" | "pe" | "pb" | "dividend_yield" |
  "change_52w_pct" | "from_high_pct" | "volume" | "analyst_rating";

const COLS: { key: Key; label: string; num?: boolean; title?: string }[] = [
  { key: "rank", label: "#", num: true, title: "Rank by market cap" },
  { key: "name", label: "Company" },
  { key: "price", label: "Price", num: true },
  { key: "change_pct", label: "Chg %", num: true },
  { key: "market_cap", label: "Mkt Cap", num: true },
  { key: "pe", label: "P/E", num: true },
  { key: "pb", label: "P/B", num: true },
  { key: "dividend_yield", label: "Div %", num: true },
  { key: "from_high_pct", label: "52W Range", title: "Price within 52-week low–high" },
  { key: "change_52w_pct", label: "52W %", num: true },
  { key: "volume", label: "Volume", num: true },
  { key: "analyst_rating", label: "Analysts", title: "Yahoo consensus: 1 = Strong Buy … 5 = Sell" },
];

function sortValue(q: Quote, k: Key): number | string | null {
  if (k === "name") return q.name.toLowerCase();
  if (k === "analyst_rating") return rating(q.analyst_rating)?.score ?? null;
  return (q[k] as number | null | undefined) ?? null;
}

function RangeBar({ q }: { q: Quote }) {
  if (q.low_52w == null || q.high_52w == null || q.price == null || q.high_52w <= q.low_52w)
    return <span className="muted">—</span>;
  const p = Math.max(0, Math.min(1, (q.price - q.low_52w) / (q.high_52w - q.low_52w)));
  return (
    <span
      className="range"
      title={`52W low ${price(q.low_52w, q.currency)} · high ${price(q.high_52w, q.currency)} · ${pct(q.from_high_pct, 1)} from high`}
    >
      <span className="range-track">
        <span className="range-mark" style={{ left: `${p * 100}%` }} />
      </span>
    </span>
  );
}

export function SectorTable({
  detail,
  loading,
  onSelect,
}: {
  detail: SectorDetail | null;
  loading: boolean;
  onSelect: (s: Selection) => void;
}) {
  const [sort, setSort] = useState<{ key: Key; asc: boolean }>({ key: "rank", asc: true });
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    if (!detail) return [];
    const f = filter.trim().toLowerCase();
    const list = f
      ? detail.companies.filter((c) => c.name.toLowerCase().includes(f) || c.symbol.toLowerCase().includes(f))
      : detail.companies;
    return [...list].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.asc ? c : -c;
    });
  }, [detail, sort, filter]);

  const onSort = (key: Key) =>
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === "rank" || key === "name" }));

  const s = detail?.sector;
  return (
    <section className="panel sector-table">
      <header className="panel-head">
        <div className="sector-title">
          <h2>{s ? s.name : "Sector"}</h2>
          {s && (
            <span className="muted small">
              {s.count} companies · ▲ {s.advances} ▼ {s.declines} · Mcap-wtd <b className={`chg ${dir(s.weighted_change_pct)}`}>{pct(s.weighted_change_pct)}</b>
            </span>
          )}
        </div>
        <div className="head-actions">
          {s?.index && (
            <button
              className="link-btn"
              onClick={() => onSelect({ symbol: s.index!.symbol, name: s.index!.name, kind: "index", currency: s.index!.currency })}
            >
              {s.index.name} chart →
            </button>
          )}
          <input
            className="filter"
            placeholder="Filter companies…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter companies"
          />
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`${c.num ? "num" : ""} ${sort.key === c.key ? "sorted" : ""}`}
                  title={c.title}
                  aria-sort={sort.key === c.key ? (sort.asc ? "ascending" : "descending") : "none"}
                >
                  <button onClick={() => onSort(c.key)}>
                    {c.label}
                    {sort.key === c.key && <span aria-hidden>{sort.asc ? " ↑" : " ↓"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length && (
              <tr><td colSpan={COLS.length} className="empty">Loading…</td></tr>
            )}
            {!loading && !rows.length && (
              <tr><td colSpan={COLS.length} className="empty">No companies match.</td></tr>
            )}
            {rows.map((q) => {
              const r = rating(q.analyst_rating);
              return (
                <tr
                  key={q.symbol}
                  onClick={() => onSelect({ symbol: q.symbol, name: q.name, kind: "stock", currency: q.currency })}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSelect({ symbol: q.symbol, name: q.name, kind: "stock", currency: q.currency })}
                >
                  <td className="num muted">{q.rank}</td>
                  <td className="company">
                    <span className="sym">{ticker(q.symbol)}</span>
                    <span className="cname">{q.name}</span>
                  </td>
                  <td className="num">{price(q.price, q.currency)}</td>
                  <td className="num"><Change pctValue={q.change_pct} /></td>
                  <td className="num">{marketCap(q.market_cap, q.currency)}</td>
                  <td className="num">{ratio(q.pe)}</td>
                  <td className="num">{ratio(q.pb)}</td>
                  <td className="num">{q.dividend_yield != null ? q.dividend_yield.toFixed(2) : "—"}</td>
                  <td><RangeBar q={q} /></td>
                  <td className={`num chg ${dir(q.change_52w_pct)}`}>{pct(q.change_52w_pct, 1)}</td>
                  <td className="num">{volume(q.volume)}</td>
                  <td>
                    {r ? (
                      <span className={`rating r${Math.min(5, Math.max(1, Math.round(r.score)))}`} title={q.analyst_rating ?? ""}>
                        {r.score.toFixed(1)} {r.label}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
