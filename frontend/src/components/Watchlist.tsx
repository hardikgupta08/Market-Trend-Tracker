import { useRef, useState } from "react";
import { enc, useApi } from "../api";
import type { Quote, RegionId, Selection } from "../types";
import { dir, marketCap, marketState, pct, price, ratio, rating, ticker, volume } from "../format";
import { useWatchlist } from "../watchlist";
import { Change } from "./Change";
import { RangeBar, sortValue, type Key } from "./SectorTable";
import { WatchStar } from "./WatchStar";

type SortKey = Exclude<Key, "rank">;

const COLS: { key: SortKey; label: string; num?: boolean; title?: string }[] = [
  { key: "name", label: "Company" },
  { key: "price", label: "Price", num: true },
  { key: "change_pct", label: "Chg %", num: true },
  { key: "market_cap", label: "Mkt Cap", num: true },
  { key: "pe", label: "P/E", num: true },
  { key: "from_high_pct", label: "52W Range", title: "Price within 52-week low–high" },
  { key: "change_52w_pct", label: "52W %", num: true },
  { key: "volume", label: "Volume", num: true },
  { key: "analyst_rating", label: "Analysts", title: "Yahoo consensus: 1 = Strong Buy … 5 = Sell" },
];

const GROUP_LABEL: Record<string, string> = { india: "India", world: "World", other: "Other" };

function WatchTable({
  group,
  rows,
  sort,
  onSort,
  onSelect,
}: {
  group: string;
  rows: Quote[];
  sort: { key: SortKey; asc: boolean } | null;
  onSort: (key: SortKey) => void;
  onSelect: (s: Selection) => void;
}) {
  const sorted = !sort
    ? rows
    : [...rows].sort((a, b) => {
        const va = sortValue(a, sort.key);
        const vb = sortValue(b, sort.key);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const c = va < vb ? -1 : va > vb ? 1 : 0;
        return sort.asc ? c : -c;
      });
  const up = rows.filter((q) => dir(q.change_pct) === "up").length;
  const down = rows.filter((q) => dir(q.change_pct) === "down").length;
  const state = rows.find((q) => q.market_state)?.market_state;

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="sector-title">
          <h2>{GROUP_LABEL[group]}</h2>
          <span className="muted small">
            {rows.length} {rows.length === 1 ? "stock" : "stocks"} · ▲ {up} ▼ {down}
            {state ? ` · ${marketState(state)}` : ""}
          </span>
        </div>
      </header>
      <div className="table-wrap">
        <table className="watch-table">
          <thead>
            <tr>
              <th className="star-col" aria-label="Watchlist" />
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`${c.num ? "num" : ""} ${sort?.key === c.key ? "sorted" : ""}`}
                  title={c.title}
                  aria-sort={sort?.key === c.key ? (sort.asc ? "ascending" : "descending") : "none"}
                >
                  <button onClick={() => onSort(c.key)}>
                    {c.label}
                    {sort?.key === c.key && <span aria-hidden>{sort.asc ? " ↑" : " ↓"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((q) => {
              const r = rating(q.analyst_rating);
              const select = () =>
                onSelect({
                  symbol: q.symbol,
                  name: q.name,
                  kind: "stock",
                  currency: q.currency,
                  region: q.region ?? undefined,
                });
              return (
                <tr key={q.symbol} onClick={select} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && select()}>
                  <td className="star-col"><WatchStar symbol={q.symbol} /></td>
                  <td>
                    <span className="company">
                      <span className="sym">{ticker(q.symbol)}</span>
                      <span className="cname">{q.sector_name ? `${q.name} · ${q.sector_name}` : q.name}</span>
                    </span>
                  </td>
                  <td className="num">{price(q.price, q.currency)}</td>
                  <td className="num"><Change pctValue={q.change_pct} /></td>
                  <td className="num">{marketCap(q.market_cap, q.currency)}</td>
                  <td className="num">{ratio(q.pe)}</td>
                  <td><RangeBar q={q} /></td>
                  <td className="num"><span className={`chg ${dir(q.change_52w_pct)}`}>{pct(q.change_52w_pct, 1)}</span></td>
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

export function Watchlist({
  region,
  version,
  onSelect,
}: {
  region: RegionId;
  version: unknown;
  onSelect: (s: Selection) => void;
}) {
  const symbols = useWatchlist();
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean } | null>(null);
  const { data, loading, error } = useApi<Quote[]>(symbols.length ? `/quotes?symbols=${enc(symbols.join(","))}` : null, version);

  // The request path changes with every add/remove; remember quotes so rows don't flash meanwhile.
  const known = useRef<Record<string, Quote>>({});
  for (const q of data ?? []) known.current[q.symbol] = q;

  if (!symbols.length) {
    return (
      <div className="loading-screen">
        <span className="watch-empty-star" aria-hidden>☆</span>
        <p>
          Your watchlist is empty. Click the ☆ next to any stock in the search results, a sector table, the movers or
          today's picks, or Watch on its detail page.
        </p>
      </div>
    );
  }

  // Keep the markets apart: currencies differ, so sorting across them would mean nothing.
  const rows = symbols.flatMap((s) => {
    const q = known.current[s];
    if (q) return [q];
    // Only a successful response can say a symbol has no quote; a failed request says nothing about it.
    return loading || error ? [] : [{ symbol: s, name: "No quote available", price: null, change: null, change_pct: null } as Quote];
  });
  const groups = [region, region === "india" ? "world" : "india", "other"]
    .map((g) => [g, rows.filter((q) => (q.region ?? "other") === g)] as const)
    .filter(([, list]) => list.length);

  if (!groups.length) {
    return (
      <div className="loading-screen">
        {!error && <div className="loader" />}
        <p>{error ? `Couldn't load watchlist prices: ${error}` : "Loading your watchlist…"}</p>
      </div>
    );
  }

  const onSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, asc: !s.asc } : { key, asc: key === "name" }));

  return (
    <main className="picks-layout">
      {groups.map(([g, list]) => (
        <WatchTable key={g} group={g} rows={list} sort={sort} onSort={onSort} onSelect={onSelect} />
      ))}
      <p className="muted small watch-note">Saved in this browser only, so it won't appear on your other devices.</p>
    </main>
  );
}
