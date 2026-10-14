import { useApi } from "../api";
import type { Pick, PicksResponse, RegionId, Selection } from "../types";
import { marketCap, pct, price, ticker } from "../format";
import { Change } from "./Change";

const STATUS_LABEL: Record<Pick["status"], string> = {
  active: "Active",
  target_reached: "Target reached",
  stop_hit: "Stop hit",
};

/** Stop → entry → target track with a marker at the live price. */
function Progress({ p }: { p: Pick }) {
  const span = p.target - p.stop_loss;
  const at = (v: number) => Math.max(0, Math.min(1, (v - p.stop_loss) / span)) * 100;
  const now = p.price ?? p.entry;
  return (
    <span
      className="pick-track"
      role="img"
      aria-label={`Stop ${price(p.stop_loss, p.currency)}, entry ${price(p.entry, p.currency)}, target ${price(p.target, p.currency)}, now ${price(now, p.currency)}`}
    >
      <span className="pt-risk" style={{ width: `${at(p.entry)}%` }} />
      <span className="pt-reward" style={{ left: `${at(p.entry)}%`, right: 0 }} />
      <span className="pt-entry" style={{ left: `${at(p.entry)}%` }} />
      <span className="pt-now" style={{ left: `${at(now)}%` }} />
    </span>
  );
}

function longDate(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function StockPicks({
  region,
  version,
  sectorNames,
  onSelect,
}: {
  region: RegionId;
  version: unknown;
  sectorNames: Record<string, string>;
  onSelect: (s: Selection) => void;
}) {
  const { data, error } = useApi<PicksResponse>(`/markets/${region}/picks`, version);
  if (!data || data.region !== region) {
    return (
      <div className="loading-screen">
        {!error && <div className="loader" />}
        <p>{error ?? "Loading today's picks…"}</p>
      </div>
    );
  }
  const m = data.methodology;

  return (
    <main className="picks-layout">
      <section className="panel">
        <header className="panel-head">
          <div className="sector-title">
            <h2>Stock picks — analyst consensus</h2>
            <span className="muted small">
              Screened {longDate(data.generated_at)} · {data.passed} of {data.screened} Buy-rated large caps passed · rebuilt daily
              before the open
            </span>
          </div>
        </header>
        <div className="table-wrap">
          <table className="picks-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th title="Analyst consensus: 1 = Strong Buy … 5 = Sell">Consensus</th>
                <th className="num" title="Price when the screen ran">Entry</th>
                <th className="num">Live</th>
                <th className="num" title="Consensus mean 12-month analyst target">Target</th>
                <th className="num" title="Computed: entry − 3×ATR(14), max 15% below entry">Stop loss</th>
                <th className="num" title="Upside to target ÷ downside to stop">R:R</th>
                <th>Stop → Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.picks.map((p) => (
                <tr
                  key={p.symbol}
                  tabIndex={0}
                  onClick={() => onSelect({ symbol: p.symbol, name: p.name, kind: "stock", currency: p.currency })}
                  onKeyDown={(e) => e.key === "Enter" && onSelect({ symbol: p.symbol, name: p.name, kind: "stock", currency: p.currency })}
                  title={p.reasons.join("\n")}
                >
                  <td>
                    <span className="company">
                      <span className="sym">{ticker(p.symbol)}</span>
                      <span className="cname">
                        {p.name} · {sectorNames[p.sector] ?? p.sector} · {marketCap(p.market_cap, p.currency)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`rating ${p.rating <= 1.5 ? "r1" : "r2"}`}>{p.rating.toFixed(2)}</span>{" "}
                    <span className="muted small">{p.analysts} analysts</span>
                  </td>
                  <td className="num">{price(p.entry, p.currency)}</td>
                  <td className="num">
                    <span className="live">
                      {price(p.price, p.currency)}
                      <span className="muted small">{pct(p.since_entry_pct)} since entry</span>
                    </span>
                  </td>
                  <td className="num">
                    <span className="live">
                      {price(p.target, p.currency)}
                      <span className="chg up small">{pct(p.upside_pct, 1)}</span>
                    </span>
                  </td>
                  <td className="num">
                    <span className="live">
                      {price(p.stop_loss, p.currency)}
                      <span className="chg down small">{pct(-p.risk_pct, 1)}</span>
                    </span>
                  </td>
                  <td className="num">{p.risk_reward.toFixed(1)}×</td>
                  <td>
                    <Progress p={p} />
                  </td>
                  <td>
                    <span className="status-cell">
                      <span className={`pick-status ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                      <Change pctValue={p.change_pct} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.picks.length && <p className="empty">No stocks passed today's screen.</p>}
        </div>
      </section>

      <section className="panel method">
        <header className="panel-head">
          <h2>How these are picked</h2>
        </header>
        <dl className="kv method-kv">
          <dt>Source</dt>
          <dd>{m.source}</dd>
          <dt>Target</dt>
          <dd>{m.target}</dd>
          <dt>Stop loss</dt>
          <dd>{m.stop_loss}</dd>
          <dt>Screen</dt>
          <dd>{m.screen}</dd>
          <dt>Horizon</dt>
          <dd>{m.horizon}</dd>
        </dl>
        <p className="disclaimer small">
          For information only — not investment advice. Analyst targets are 12-month views and are often revised; stop
          losses are a mechanical volatility rule, not a recommendation from any analyst. Hover a row to see why it was
          picked. Do your own research before trading.
        </p>
      </section>
    </main>
  );
}
