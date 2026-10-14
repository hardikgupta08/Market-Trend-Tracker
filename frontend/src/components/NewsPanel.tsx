import { useEffect, useState } from "react";
import { enc, useApi } from "../api";
import type { NewsItem, NewsResponse, RegionId } from "../types";
import { timeAgo } from "../format";

export function NewsList({ items, compact }: { items: NewsItem[]; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <ul className={`news ${compact ? "compact" : ""}`}>
      {items.map((n) => (
        <li key={n.link ?? n.title}>
          <a href={n.link} target="_blank" rel="noopener noreferrer">
            <span className="news-meta">
              <span className="news-src">{n.source}</span>
              <time dateTime={n.published ?? undefined}>{timeAgo(n.published, now)}</time>
            </span>
            <span className="news-title">{n.title}</span>
            {!compact && n.summary && <span className="news-sum">{n.summary}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function NewsPanel({
  region,
  sectorId,
  sectorName,
  version,
}: {
  region: RegionId;
  sectorId: string | null;
  sectorName?: string;
  version: unknown;
}) {
  const [scope, setScope] = useState<"market" | "sector">("market");
  const [query, setQuery] = useState("");
  const path =
    scope === "sector" && sectorId
      ? `/news?region=${region}&sector=${enc(sectorId)}&limit=60`
      : `/news?region=${region}&limit=120`;
  const { data, loading, error } = useApi<NewsResponse>(path, version);

  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter(
    (n) => !q || n.title.toLowerCase().includes(q) || n.source.toLowerCase().includes(q),
  );

  return (
    <section className="panel news-panel">
      <header className="panel-head">
        <h2>Latest News</h2>
        <div className="seg" role="tablist" aria-label="News scope">
          <button role="tab" aria-selected={scope === "market"} onClick={() => setScope("market")}>
            Markets
          </button>
          <button
            role="tab"
            aria-selected={scope === "sector"}
            onClick={() => setScope("sector")}
            disabled={!sectorId}
            title={sectorName}
          >
            {sectorName ? (sectorName.length > 18 ? sectorName.split(/[ ,&—]/)[0] : sectorName) : "Sector"}
          </button>
        </div>
      </header>
      <input
        className="filter block"
        placeholder="Filter headlines…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter headlines"
      />
      <div className="news-scroll">
        {error && !data && <p className="empty">{error}</p>}
        {loading && !data && <p className="empty">Loading headlines…</p>}
        <NewsList items={items} />
        {data && !items.length && <p className="empty">No headlines match.</p>}
      </div>
    </section>
  );
}
