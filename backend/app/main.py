"""FastAPI application: REST API for the market terminal."""
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, market, news, service, store
from .universe import REGIONS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

RegionId = Literal["india", "world"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    service.load_persisted()
    service.start_scheduler()
    yield
    service.stop_scheduler()


app = FastAPI(title="Market Terminal API", version="1.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


def _snapshot_or_503(region: str) -> dict:
    snap = service.snapshot(region)
    if snap is None:
        raise HTTPException(503, "Market data is still loading — the first refresh takes a minute or two.")
    return snap


def _find_stock(symbol: str) -> tuple[str, dict] | None:
    for rid in REGIONS:
        snap = service.snapshot(rid)
        if not snap:
            continue
        for rows in snap["sector_rows"].values():
            for r in rows:
                if r["symbol"] == symbol:
                    return rid, r
    return None


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/status")
def status():
    return service.status()


@app.post("/api/refresh", status_code=202)
def refresh():
    service.trigger_refresh()
    return {"accepted": True}


@app.get("/api/regions")
def regions():
    return [
        {"id": r.id, "name": r.name, "currency": r.currency,
         "sectors": [{"id": s.id, "name": s.name, "index": s.index, "count": len(s.symbols)} for s in r.sectors]}
        for r in REGIONS.values()
    ]


@app.get("/api/markets/{region}/overview")
def overview(region: RegionId):
    snap = _snapshot_or_503(region)
    return {k: v for k, v in snap.items() if k != "sector_rows"}


@app.get("/api/markets/{region}/indices")
def indices(region: RegionId):
    snap = _snapshot_or_503(region)
    return {"updated_at": snap["updated_at"], "indices": snap["indices"], "macro": snap["macro"]}


@app.get("/api/markets/{region}/sectors")
def sectors(region: RegionId):
    snap = _snapshot_or_503(region)
    return {"updated_at": snap["updated_at"], "sectors": snap["sectors"]}


@app.get("/api/markets/{region}/sectors/{sector_id}")
def sector_detail(region: RegionId, sector_id: str):
    snap = _snapshot_or_503(region)
    summary = next((s for s in snap["sectors"] if s["id"] == sector_id), None)
    if summary is None:
        raise HTTPException(404, f"Unknown sector '{sector_id}'")
    return {"updated_at": snap["updated_at"], "currency": snap["currency"], "sector": summary,
            "companies": snap["sector_rows"].get(sector_id, [])}


@app.get("/api/markets/{region}/movers")
def movers(region: RegionId):
    snap = _snapshot_or_503(region)
    return {"updated_at": snap["updated_at"], **snap["movers"], "breadth": snap["breadth"]}


@app.get("/api/stocks/{symbol}")
def stock(symbol: str):
    found = _find_stock(symbol)
    if found is None:
        quotes = market.fetch_quotes([symbol])
        if symbol not in quotes:
            raise HTTPException(404, f"Unknown symbol '{symbol}'")
        return {"region": None, **quotes[symbol]}
    rid, row = found
    return {"region": rid, **row}


@app.get("/api/chart/{symbol}")
def chart(symbol: str, range: Literal[tuple(market.RANGES)] = "1y"):  # type: ignore[valid-type]
    try:
        return service.cached(f"chart:{symbol}:{range}", config.CHART_CACHE_SECONDS,
                              lambda: market.fetch_chart(symbol, range))
    except Exception as exc:
        raise HTTPException(502, f"Chart unavailable: {exc}")


@app.get("/api/history/{symbol}")
def refresh_history(symbol: str, limit: int = Query(500, le=5000)):
    """Index values captured at each scheduled refresh."""
    return {"symbol": symbol, "points": store.index_history(symbol, limit)}


@app.get("/api/news")
def get_news(
    region: RegionId = "india",
    sector: str | None = None,
    symbol: str | None = None,
    limit: int = Query(60, le=200),
):
    reg = REGIONS[region]
    if symbol:
        found = _find_stock(symbol)
        name = found[1]["name"] if found else symbol
        # Trim corporate suffixes for a better search.
        for suffix in (" Limited", " Ltd.", " Ltd", " Inc.", " Corporation", " Corp.", " plc", " N.V.", " Holdings"):
            name = name.replace(suffix, "")
        query = f'"{name.strip()}" stock'
        items = service.cached(f"news:sym:{symbol}", config.ONDEMAND_NEWS_CACHE_SECONDS,
                               lambda: news.google_news(query, reg.news_locale))
        return {"scope": "symbol", "query": query, "items": items[:limit]}
    if sector:
        sec = reg.sector_by_id.get(sector)
        if sec is None:
            raise HTTPException(404, f"Unknown sector '{sector}'")
        items = service.cached(f"news:sec:{region}:{sector}", config.ONDEMAND_NEWS_CACHE_SECONDS,
                               lambda: news.google_news(sec.news_query, reg.news_locale))
        return {"scope": "sector", "query": sec.news_query, "items": items[:limit]}
    payload = service.market_news(region)
    if payload is None:
        raise HTTPException(503, "News is still loading.")
    return {"scope": "market", "updated_at": payload["updated_at"], "items": payload["items"][:limit]}


@app.get("/api/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, le=100)):
    ql = q.lower()
    hits = []
    for rid in REGIONS:
        snap = service.snapshot(rid)
        if not snap:
            continue
        for sec_id, rows in snap["sector_rows"].items():
            for r in rows:
                sym = r["symbol"].lower()
                score = 0 if sym.split(".")[0] == ql else 1 if sym.startswith(ql) else 2 if ql in r["name"].lower() else None
                if score is not None:
                    hits.append((score, -(r.get("market_cap") or 0), {
                        "symbol": r["symbol"], "name": r["name"], "region": rid, "sector": sec_id,
                        "price": r.get("price"), "change_pct": r.get("change_pct"), "currency": r.get("currency"),
                    }))
    hits.sort(key=lambda h: (h[0], h[1]))
    return [h[2] for h in hits[:limit]]


# Serve the built frontend when present (production / single-process mode).
if (config.FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = config.FRONTEND_DIST / path
        if path and file.is_file():
            return FileResponse(file)
        return FileResponse(config.FRONTEND_DIST / "index.html")
