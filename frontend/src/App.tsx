import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useApi } from "./api";
import type { Instrument, Overview, RegionId, SearchHit, SectorDetail, Selection, Status } from "./types";
import { clock, countdown, marketState } from "./format";
import { TickerTape } from "./components/TickerTape";
import { IndexPanel } from "./components/IndexPanel";
import { SectorHeatmap } from "./components/SectorHeatmap";
import { SectorTable } from "./components/SectorTable";
import { MoversPanel } from "./components/MoversPanel";
import { NewsPanel } from "./components/NewsPanel";
import { DetailDrawer } from "./components/DetailDrawer";
import { Search } from "./components/Search";
import { SectorBriefs } from "./components/SectorBriefs";
import { StockPicks } from "./components/StockPicks";

type Theme = "dark" | "light";
type View = "dashboard" | "briefs" | "picks";
const VIEWS: [View, string][] = [
  ["dashboard", "Dashboard"],
  ["briefs", "Sector Brief"],
  ["picks", "Stock Picks"],
];
type Palette = "gr" | "br";

function stored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

export default function App() {
  const [region, setRegion] = useState<RegionId>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("region");
    return fromUrl === "india" || fromUrl === "world" ? fromUrl : stored<RegionId>("mt.region", "india");
  });
  const [view, setView] = useState<View>(() => {
    const v = new URLSearchParams(window.location.search).get("view") ?? stored<View>("mt.view", "dashboard");
    return VIEWS.some(([id]) => id === v) ? (v as View) : "dashboard";
  });
  const [theme, setTheme] = useState<Theme>(() => stored<Theme>("mt.theme", "dark"));
  const [palette, setPalette] = useState<Palette>(() => stored<Palette>("mt.palette", "gr"));
  const [sectorByRegion, setSectorByRegion] = useState<Record<string, string | null>>({});
  const [selection, setSelection] = useState<Selection | null>(() => {
    const p = new URLSearchParams(window.location.search);
    const symbol = p.get("symbol");
    return symbol ? { symbol, kind: p.get("kind") === "index" ? "index" : "stock" } : null;
  });
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = palette;
    store("mt.theme", theme);
    store("mt.palette", palette);
  }, [theme, palette]);
  useEffect(() => {
    store("mt.region", region);
    store("mt.view", view);
    const url = new URL(window.location.href);
    url.searchParams.set("region", region);
    url.searchParams.set("view", view);
    if (selection) {
      url.searchParams.set("symbol", selection.symbol);
      url.searchParams.set("kind", selection.kind);
    } else {
      url.searchParams.delete("symbol");
      url.searchParams.delete("kind");
    }
    window.history.replaceState(null, "", url);
  }, [region, view, selection]);

  // Poll backend status; snapshot timestamps drive data re-fetches.
  useEffect(() => {
    let alive = true;
    const poll = () => api<Status>("/status").then((s) => alive && setStatus(s)).catch(() => {});
    poll();
    const t = window.setInterval(poll, 10_000);
    const c = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.clearInterval(c);
    };
  }, []);

  const regionStatus = status?.regions[region];
  const marketVersion = regionStatus?.updated_at ?? 0;
  const newsVersion = regionStatus?.news_updated_at ?? 0;
  const picksVersion = `${regionStatus?.picks_generated_at}|${marketVersion}`;

  const overview = useApi<Overview>(`/markets/${region}/overview`, marketVersion);
  const ov = overview.data?.region === region ? overview.data : null;

  const sectorId = sectorByRegion[region] ?? ov?.sectors[0]?.id ?? null;
  const sector = useApi<SectorDetail>(sectorId ? `/markets/${region}/sectors/${sectorId}` : null, marketVersion);

  const indexLookup = useMemo(() => {
    const m: Record<string, Instrument> = {};
    if (!ov) return m;
    for (const i of [...ov.indices, ...ov.macro]) m[i.symbol] = i;
    for (const s of ov.sectors) if (s.index) m[s.index.symbol] = { ...s.index, name: s.index.name };
    return m;
  }, [ov]);

  const sectorNames = useMemo(
    () => Object.fromEntries((ov?.sectors ?? []).map((s) => [s.id, s.name])),
    [ov],
  );

  const pickSector = (id: string) => setSectorByRegion((m) => ({ ...m, [region]: id }));

  const onSearch = (h: SearchHit) => {
    setView("dashboard");
    setRegion(h.region);
    setSectorByRegion((m) => ({ ...m, [h.region]: h.sector }));
    setSelection({ symbol: h.symbol, name: h.name, kind: "stock", currency: h.currency });
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    try {
      await api("/refresh", { method: "POST" });
    } finally {
      window.setTimeout(() => setRefreshing(false), 4000);
    }
  };

  const closeDrawer = useCallback(() => setSelection(null), []);
  const busy = refreshing || !!status?.running.some((j) => j === "markets" || j === "news");
  const tape = ov ? [...ov.indices.slice(0, 12), ...ov.macro] : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
            <polyline points="5,22 12,15 17,19 27,8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>MARKET<b>TERMINAL</b></span>
        </div>
        <nav className="region-tabs" role="tablist" aria-label="Region">
          {(["india", "world"] as RegionId[]).map((r) => (
            <button key={r} role="tab" aria-selected={region === r} onClick={() => setRegion(r)}>
              {r === "india" ? "India" : "World"}
            </button>
          ))}
        </nav>
        <nav className="view-tabs seg" role="tablist" aria-label="View">
          {VIEWS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <Search onPick={onSearch} />
        <div className="status">
          <span className={`pill state-${regionStatus?.market_state ?? "NA"}`}>{marketState(regionStatus?.market_state)}</span>
          <span className="muted small" title={regionStatus?.updated_at ?? ""}>
            Updated {clock(regionStatus?.updated_at)} · next in {countdown(status?.next_run.markets, now)}
          </span>
          <button className={`icon-btn ${busy ? "spin" : ""}`} onClick={manualRefresh} disabled={busy} title="Refresh now" aria-label="Refresh now">
            ⟳
          </button>
          <button
            className="icon-btn"
            onClick={() => setPalette(palette === "gr" ? "br" : "gr")}
            title={palette === "gr" ? "Switch to colour-blind-safe blue/orange" : "Switch to green/red"}
            aria-label="Toggle up/down colours"
          >
            <span className="palette-dot" />
          </button>
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <TickerTape items={tape} onSelect={setSelection} />

      {!ov ? (
        <div className="loading-screen">
          {overview.error && !overview.loading ? (
            <p>Couldn't reach the API: {overview.error}</p>
          ) : (
            <>
              <div className="loader" />
              <p>{overview.error ?? "Loading market data…"}</p>
            </>
          )}
        </div>
      ) : view === "briefs" ? (
        <SectorBriefs
          region={region}
          currency={ov.currency}
          version={marketVersion}
          newsVersion={newsVersion}
          selected={sectorId}
          onPick={pickSector}
          onSelect={setSelection}
        />
      ) : view === "picks" ? (
        <StockPicks region={region} version={picksVersion} sectorNames={sectorNames} onSelect={setSelection} />
      ) : (
        <main className="grid">
          <div className="col left">
            <IndexPanel indices={ov.indices} macro={ov.macro} onSelect={setSelection} />
          </div>
          <div className="col center">
            <SectorHeatmap sectors={ov.sectors} currency={ov.currency} selected={sectorId} onSelect={pickSector} />
            <SectorTable
              detail={sector.data?.sector.id === sectorId ? sector.data : null}
              loading={sector.loading}
              onSelect={setSelection}
            />
          </div>
          <div className="col right">
            <MoversPanel overview={ov} sectorNames={sectorNames} onSelect={setSelection} />
            <NewsPanel region={region} sectorId={sectorId} sectorName={sectorId ? sectorNames[sectorId] : undefined} version={newsVersion} />
          </div>
        </main>
      )}

      <footer className="footer muted small">
        Data: Yahoo Finance (may be delayed) · News: publisher RSS &amp; Google News · Prices &amp; news refresh every{" "}
        {status?.refresh_interval_minutes ?? 1} min · Picks rebuilt daily · Not investment advice
      </footer>

      {selection && <DetailDrawer selection={selection} region={region} indexLookup={indexLookup} onClose={closeDrawer} />}
    </div>
  );
}
