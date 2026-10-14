import { enc, useApi } from "../api";
import type { BriefStock, BriefsResponse, NewsResponse, RegionId, SectorBrief, Selection, Stance } from "../types";
import { dir, pct, price, ratio, ticker } from "../format";
import { Change } from "./Change";
import { NewsList } from "./NewsPanel";

const RETURNS: [keyof SectorBrief["performance"], string][] = [
  ["day", "Today"],
  ["ret_1w", "1W"],
  ["ret_1m", "1M"],
  ["ret_3m", "3M"],
  ["ret_ytd", "YTD"],
  ["ret_1y", "1Y"],
];

export function stanceClass(s: Stance) {
  return s === "Bullish" || s === "Positive" ? "up" : s === "Neutral" ? "flat" : "down";
}

/** Diverging bar for the -100…+100 composite score, centred on zero. */
function ScoreBar({ score }: { score: number }) {
  const w = Math.min(100, Math.abs(score)) / 2;
  return (
    <span className="score-bar" title={`Composite score ${score > 0 ? "+" : ""}${score} (−100 … +100)`}>
      <span className={`score-fill ${dir(score)}`} style={score >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
    </span>
  );
}

function Meter({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div className="meter" title={hint}>
      <div className="meter-top">
        <span>{label}</span>
        <b className="num">{value == null ? "—" : `${value.toFixed(0)}%`}</b>
      </div>
      <span className="meter-track">
        <span className={`meter-fill ${value == null ? "" : value >= 60 ? "up" : value <= 40 ? "down" : "flat"}`} style={{ width: `${value ?? 0}%` }} />
      </span>
    </div>
  );
}

function StockList({
  title,
  items,
  currency,
  onSelect,
}: {
  title: string;
  items: BriefStock[];
  currency: string;
  onSelect: (s: Selection) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="brief-section">
      <h3>{title}</h3>
      <ul className="movers">
        {items.map((m) => (
          <li key={m.symbol}>
            <button className="mover" onClick={() => onSelect({ symbol: m.symbol, name: m.name, kind: "stock", currency })}>
              <span className="mover-id">
                <span className="sym">{ticker(m.symbol)}</span>
                <span className="cname">{m.name}</span>
              </span>
              <span className="num">{price(m.price, currency)}</span>
              <Change pctValue={m.change_52w_pct} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BriefDetail({
  brief,
  region,
  benchName,
  currency,
  newsVersion,
  onSelect,
}: {
  brief: SectorBrief;
  region: RegionId;
  benchName: string;
  currency: string;
  newsVersion: unknown;
  onSelect: (s: Selection) => void;
}) {
  const news = useApi<NewsResponse>(`/news?region=${region}&sector=${enc(brief.id)}&limit=6`, newsVersion);
  const { performance: p, relative: rel, breadth: b, valuation: v, sentiment: s } = brief;

  return (
    <article className="panel brief-detail">
      <header className="brief-head">
        <div>
          <h2 className="brief-title">{brief.name}</h2>
          <p className="brief-headline">{brief.headline}</p>
        </div>
        <span className={`stance ${stanceClass(brief.stance)}`}>
          {brief.stance} <span className="num">{brief.score > 0 ? "+" : ""}{brief.score}</span>
        </span>
      </header>

      <section className="brief-section">
        <h3>Performance</h3>
        <div className="ret-grid">
          {RETURNS.map(([k, label]) => (
            <div key={k} className="ret-cell">
              <span className="muted small">{label}</span>
              <Change pctValue={p[k]} />
            </div>
          ))}
        </div>
        <p className="muted small">
          Source: {brief.performance_source}. Relative to {benchName}: 1M{" "}
          <span className={`chg ${dir(rel.ret_1m)}`}>{pct(rel.ret_1m, 1).replace("%", " pts")}</span> · 3M{" "}
          <span className={`chg ${dir(rel.ret_3m)}`}>{pct(rel.ret_3m, 1).replace("%", " pts")}</span> · 1Y{" "}
          <span className={`chg ${dir(rel.ret_1y)}`}>{pct(rel.ret_1y, 1).replace("%", " pts")}</span>
        </p>
      </section>

      <div className="brief-cols">
        <section className="brief-section">
          <h3>Trend &amp; breadth</h3>
          <Meter label="Above 200-day avg" value={b.above_200dma_pct} hint="Share of stocks trading above their 200-day moving average (long-term trend)" />
          <Meter label="Above 50-day avg" value={b.above_50dma_pct} hint="Share of stocks trading above their 50-day moving average (short-term momentum)" />
          <Meter label="Within 5% of 52W high" value={b.near_high_pct} hint="Share of stocks near their 52-week high" />
          <p className="muted small">
            Today: ▲ {b.advances} · ▼ {b.declines} · median stock {pct(b.median_from_high_pct, 1)} from its 52W high
          </p>
        </section>
        <section className="brief-section">
          <h3>Valuation &amp; analysts</h3>
          <dl className="kv">
            <dt>Median P/E</dt>
            <dd className="num">{ratio(v.median_pe)} <span className="muted">vs {ratio(v.market_median_pe)} market</span></dd>
            <dt>Median forward P/E</dt>
            <dd className="num">{ratio(v.median_forward_pe)}</dd>
            <dt>Median P/B</dt>
            <dd className="num">{ratio(v.median_pb)}</dd>
            <dt>Median div. yield (payers)</dt>
            <dd className="num">{v.median_dividend_yield == null ? "—" : `${v.median_dividend_yield.toFixed(2)}%`}</dd>
            <dt>Buy-rated stocks</dt>
            <dd className="num">{s.buy_share_pct == null ? "—" : `${s.buy_share_pct.toFixed(0)}%`} <span className="muted">of {s.rated}</span></dd>
            <dt>Avg consensus</dt>
            <dd className="num">{ratio(s.avg_rating, 2)} <span className="muted">1 Strong Buy … 5 Sell</span></dd>
          </dl>
        </section>
      </div>

      <section className="brief-section">
        <h3>Signals</h3>
        <ul className="signals">
          {brief.signals.map((sg) => (
            <li key={sg.text} className={sg.tone}>
              <span className="sig-dot" aria-hidden>{sg.tone === "pos" ? "▲" : sg.tone === "neg" ? "▼" : "●"}</span>
              {sg.text}
            </li>
          ))}
        </ul>
      </section>

      {brief.watch.length > 0 && (
        <section className="brief-section">
          <h3>Outlook — what to watch</h3>
          <ul className="watch">
            {brief.watch.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="brief-cols">
        <StockList title="1-year leaders" items={brief.leaders_1y} currency={currency} onSelect={onSelect} />
        <StockList title="1-year laggards" items={brief.laggards_1y} currency={currency} onSelect={onSelect} />
      </div>

      <section className="brief-section">
        <h3>Latest sector headlines</h3>
        {news.loading && !news.data && <p className="muted small">Loading headlines…</p>}
        {news.data && <NewsList items={news.data.items} compact />}
        {news.data && !news.data.items.length && <p className="muted small">No recent headlines.</p>}
      </section>
    </article>
  );
}

export function SectorBriefs({
  region,
  currency,
  version,
  newsVersion,
  selected,
  onPick,
  onSelect,
}: {
  region: RegionId;
  currency: string;
  version: unknown;
  newsVersion: unknown;
  selected: string | null;
  onPick: (id: string) => void;
  onSelect: (s: Selection) => void;
}) {
  const { data, error } = useApi<BriefsResponse>(`/markets/${region}/briefs`, version);
  if (!data || data.region !== region) {
    return <div className="loading-screen">{error ? <p>{error}</p> : <div className="loader" />}</div>;
  }
  const brief = data.briefs.find((b) => b.id === selected) ?? data.briefs[0];
  const benchName = data.benchmark.name ?? data.benchmark.symbol;

  return (
    <main className="brief-layout">
      <section className="panel scorecard">
        <header className="panel-head">
          <h2>Sector scorecard</h2>
          <span className="muted small">vs {benchName} {pct(data.benchmark.ret_1m, 1)} 1M</span>
        </header>
        <ol className="score-list">
          {data.briefs.map((b) => (
            <li key={b.id}>
              <button className={`score-row ${b.id === brief.id ? "selected" : ""}`} onClick={() => onPick(b.id)} aria-current={b.id === brief.id}>
                <span className="score-name">
                  <span>{b.name}</span>
                  <span className={`stance-text ${stanceClass(b.stance)}`}>{b.stance}</span>
                </span>
                <ScoreBar score={b.score} />
                <span className="score-rets">
                  <span className="muted small">1D</span>
                  <Change pctValue={b.performance.day} showArrow={false} />
                  <span className="muted small">1M</span>
                  <Change pctValue={b.performance.ret_1m} showArrow={false} />
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="muted small scorecard-note">
          Score blends long-term trend (% above 200-DMA), momentum (% above 50-DMA), relative strength vs {benchName} and
          distance from 52-week highs. Recomputed every refresh.
        </p>
      </section>
      <BriefDetail key={brief.id} brief={brief} region={region} benchName={benchName} currency={currency} newsVersion={newsVersion} onSelect={onSelect} />
    </main>
  );
}
