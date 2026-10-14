import { useEffect, useState } from "react";
import { enc, useApi } from "../api";
import type { ChartResponse, Instrument, NewsResponse, Quote, RegionId, Selection } from "../types";
import { dir, marketCap, pct, price, ratio, rating, ticker, volume, marketState } from "../format";
import { Change } from "./Change";
import { PriceChart } from "./PriceChart";
import { NewsList } from "./NewsPanel";

const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "5y", "max"] as const;
type Range = (typeof RANGES)[number];

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function DetailDrawer({
  selection,
  region,
  indexLookup,
  onClose,
}: {
  selection: Selection;
  region: RegionId;
  indexLookup: Record<string, Instrument>;
  onClose: () => void;
}) {
  const [range, setRange] = useState<Range>("1y");
  const isStock = selection.kind === "stock";
  const sym = enc(selection.symbol);

  const stock = useApi<Quote>(isStock ? `/stocks/${sym}` : null);
  const chart = useApi<ChartResponse>(`/chart/${sym}?range=${range}`);
  const news = useApi<NewsResponse>(isStock ? `/news?region=${region}&symbol=${sym}&limit=15` : null);
  // Some NSE indices have no history on Yahoo; fall back to values recorded at each refresh.
  const noHistory = !!chart.data && chart.data.points.length < 2;
  const recorded = useApi<{ points: { t: string; price: number | null }[] }>(noHistory ? `/history/${sym}?limit=2000` : null);
  const recordedPoints = (recorded.data?.points ?? [])
    .filter((p) => p.price != null)
    .map((p) => ({ t: p.t, c: p.price as number, o: null, h: null, l: null, v: null }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q: Quote | Instrument | null = isStock ? stock.data : indexLookup[selection.symbol] ?? null;
  const cur = q?.currency ?? selection.currency;
  const r = rating(q?.analyst_rating);
  const inst = q as Instrument | null;
  // Yahoo's long-range stats are unreliable for indices it has no history for.
  const unreliable = !isStock && inst?.history_source === "refresh_log";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={selection.name ?? selection.symbol}>
        <header className="drawer-head">
          <div>
            <div className="drawer-sym">
              {ticker(selection.symbol)}
              {q?.exchange && <span className="muted small"> · {q.exchange}</span>}
              {q?.market_state && <span className="pill">{marketState(q.market_state)}</span>}
            </div>
            <h2>{q?.name ?? selection.name ?? selection.symbol}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="drawer-price">
          <span className="big num">{price(q?.price, cur)}</span>
          {cur && <span className="muted small">{cur}</span>}
          <Change pctValue={q?.change_pct} abs={q?.change} currency={cur} />
        </div>

        <div className="seg ranges" role="tablist" aria-label="Chart range">
          {RANGES.map((x) => (
            <button key={x} role="tab" aria-selected={range === x} onClick={() => setRange(x)}>
              {x.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="drawer-chart">
          {chart.loading && !chart.data && <div className="chart-empty">Loading chart…</div>}
          {chart.error && <div className="chart-empty">{chart.error}</div>}
          {chart.data && !noHistory && (
            <PriceChart points={chart.data.points} currency={cur} intraday={range === "1d" || range === "5d"} />
          )}
          {noHistory && (
            <>
              <PriceChart points={recordedPoints} currency={cur} intraday />
              <p className="muted small">
                Yahoo Finance has no price history for this index, so this chart shows the values recorded at
                each scheduled refresh; it fills in over time.
              </p>
            </>
          )}
        </div>

        <dl className="stats">
          <Stat label="Open">{price(q?.open, cur)}</Stat>
          <Stat label="Prev close">{price(q?.prev_close, cur)}</Stat>
          <Stat label="Day range">{price(q?.low, cur)} – {price(q?.high, cur)}</Stat>
          {!unreliable && (
            <>
              <Stat label="52W range">{price(q?.low_52w, cur)} – {price(q?.high_52w, cur)}</Stat>
              <Stat label="From 52W high"><span className={`chg ${dir(q?.from_high_pct)}`}>{pct(q?.from_high_pct, 1)}</span></Stat>
              <Stat label="52W change"><span className={`chg ${dir(q?.change_52w_pct)}`}>{pct(q?.change_52w_pct, 1)}</span></Stat>
            </>
          )}
          {isStock ? (
            <>
              <Stat label="Market cap">{marketCap(q?.market_cap, cur)}</Stat>
              <Stat label="P/E (ttm)">{ratio(q?.pe)}</Stat>
              <Stat label="Forward P/E">{ratio(q?.forward_pe)}</Stat>
              <Stat label="P/B">{ratio(q?.pb)}</Stat>
              <Stat label="EPS (ttm)">{price(q?.eps, cur)}</Stat>
              <Stat label="Div. yield">{q?.dividend_yield != null ? `${q.dividend_yield.toFixed(2)}%` : "—"}</Stat>
              <Stat label="Volume">{volume(q?.volume)}</Stat>
              <Stat label="Avg vol (3M)">{volume(q?.avg_volume)}</Stat>
              <Stat label="50D / 200D avg">{price(q?.sma_50, cur)} / {price(q?.sma_200, cur)}</Stat>
              <Stat label="Analysts">{r ? `${r.score.toFixed(1)} · ${r.label}` : "—"}</Stat>
            </>
          ) : (
            <>
              <Stat label="1 week"><span className={`chg ${dir(inst?.ret_1w)}`}>{pct(inst?.ret_1w)}</span></Stat>
              <Stat label="1 month"><span className={`chg ${dir(inst?.ret_1m)}`}>{pct(inst?.ret_1m)}</span></Stat>
              <Stat label="3 months"><span className={`chg ${dir(inst?.ret_3m)}`}>{pct(inst?.ret_3m)}</span></Stat>
              <Stat label="YTD"><span className={`chg ${dir(inst?.ret_ytd)}`}>{pct(inst?.ret_ytd)}</span></Stat>
              <Stat label="1 year"><span className={`chg ${dir(inst?.ret_1y)}`}>{pct(inst?.ret_1y)}</span></Stat>
              {!unreliable && <Stat label="50D / 200D avg">{price(q?.sma_50, cur)} / {price(q?.sma_200, cur)}</Stat>}
            </>
          )}
        </dl>

        {isStock && (
          <section className="drawer-news">
            <h3>Company news</h3>
            {news.loading && !news.data && <p className="empty">Loading…</p>}
            {news.data && <NewsList items={news.data.items} compact />}
            {news.data && !news.data.items.length && <p className="empty">No recent headlines.</p>}
          </section>
        )}
      </aside>
    </div>
  );
}
