"""Market data fetching (Yahoo Finance via yfinance) and snapshot assembly."""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timezone

import pandas as pd
import yfinance as yf

from . import config, store
from .universe import Region

log = logging.getLogger(__name__)

config.YF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
yf.set_tz_cache_location(str(config.YF_CACHE_DIR))

QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"

# Yahoo quote field -> API field
QUOTE_FIELDS = {
    "regularMarketPrice": "price",
    "regularMarketChange": "change",
    "regularMarketChangePercent": "change_pct",
    "regularMarketOpen": "open",
    "regularMarketDayHigh": "high",
    "regularMarketDayLow": "low",
    "regularMarketPreviousClose": "prev_close",
    "regularMarketVolume": "volume",
    "averageDailyVolume3Month": "avg_volume",
    "marketCap": "market_cap",
    "trailingPE": "pe",
    "forwardPE": "forward_pe",
    "priceToBook": "pb",
    "dividendYield": "dividend_yield",
    "epsTrailingTwelveMonths": "eps",
    "fiftyTwoWeekHigh": "high_52w",
    "fiftyTwoWeekLow": "low_52w",
    "fiftyTwoWeekChangePercent": "change_52w_pct",
    "fiftyDayAverage": "sma_50",
    "twoHundredDayAverage": "sma_200",
    "averageAnalystRating": "analyst_rating",
    "currency": "currency",
    "marketState": "market_state",
    "fullExchangeName": "exchange",
    "regularMarketTime": "market_time",
    "quoteType": "quote_type",
}


def _clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _get_yf_data():
    # yfinance manages Yahoo's cookie/crumb handshake; reuse its session.
    from yfinance.data import YfData
    return YfData()


def fetch_quotes(symbols: list[str]) -> dict[str, dict]:
    """Batch-fetch live quotes. Unknown symbols are silently omitted."""
    out: dict[str, dict] = {}
    data = _get_yf_data()
    size = config.QUOTE_BATCH_SIZE
    for i in range(0, len(symbols), size):
        chunk = symbols[i:i + size]
        for attempt in range(3):
            try:
                raw = data.get_raw_json(QUOTE_URL, params={"symbols": ",".join(chunk)})
                for q in raw.get("quoteResponse", {}).get("result", []):
                    out[q["symbol"]] = _normalise_quote(q)
                break
            except Exception as exc:  # network hiccup / rate limit
                log.warning("quote batch %d failed (attempt %d): %s", i // size, attempt + 1, exc)
                time.sleep(2 * (attempt + 1))
    missing = [s for s in symbols if s not in out]
    if missing and len(missing) < len(symbols):
        log.info("no quote for %d symbols: %s", len(missing), " ".join(missing[:40]))
    elif missing:
        log.warning("quote endpoint returned nothing; falling back to price history")
        out.update(_fallback_quotes(symbols))
    return out


def _normalise_quote(q: dict) -> dict:
    row = {"symbol": q["symbol"], "name": q.get("longName") or q.get("shortName") or q["symbol"]}
    for src, dst in QUOTE_FIELDS.items():
        row[dst] = _clean(q.get(src))
    if row["price"] and row["high_52w"]:
        row["from_high_pct"] = (row["price"] / row["high_52w"] - 1) * 100
    else:
        row["from_high_pct"] = None
    if row["market_time"]:
        row["market_time"] = datetime.fromtimestamp(row["market_time"], timezone.utc).isoformat()
    return row


def _fallback_quotes(symbols: list[str]) -> dict[str, dict]:
    """Minimal quotes from daily history if the quote endpoint is unavailable."""
    out = {}
    hist = download_history(symbols, period="5d")
    for sym, closes in hist.items():
        if len(closes) < 1:
            continue
        price = closes.iloc[-1]
        prev = closes.iloc[-2] if len(closes) > 1 else None
        row = {"symbol": sym, "name": sym, **{v: None for v in QUOTE_FIELDS.values()}}
        row.update(price=float(price), prev_close=_clean(float(prev)) if prev is not None else None,
                   from_high_pct=None)
        if prev:
            row["change"] = float(price - prev)
            row["change_pct"] = float((price / prev - 1) * 100)
        out[sym] = row
    return out


def download_history(symbols: list[str], period: str = "1y", interval: str = "1d") -> dict[str, pd.Series]:
    """Close-price series per symbol. Retries symbols that failed in the threaded pass."""
    result: dict[str, pd.Series] = {}
    pending = list(symbols)
    for threads in (True, False):
        if not pending:
            break
        try:
            df = yf.download(pending, period=period, interval=interval, group_by="ticker",
                             progress=False, threads=threads, auto_adjust=False)
        except Exception as exc:
            log.warning("history download failed: %s", exc)
            continue
        for sym in pending:
            try:
                s = df[sym]["Close"] if isinstance(df.columns, pd.MultiIndex) else df["Close"]
                s = s.dropna()
                if len(s):
                    result[sym] = s
            except KeyError:
                pass
        pending = [s for s in pending if s not in result]
    return result


def download_ohlc(symbols: list[str], period: str = "6mo") -> dict[str, pd.DataFrame]:
    """Daily High/Low/Close frames per symbol (used for ATR-based stop losses)."""
    try:
        df = yf.download(symbols, period=period, interval="1d", group_by="ticker",
                         progress=False, threads=True, auto_adjust=False)
    except Exception as exc:
        log.warning("OHLC download failed: %s", exc)
        return {}
    out = {}
    for sym in symbols:
        try:
            frame = df[sym] if isinstance(df.columns, pd.MultiIndex) else df
            frame = frame[["High", "Low", "Close"]].dropna()
        except KeyError:
            continue
        if len(frame):
            out[sym] = frame
    return out


_history_cache: dict[str, tuple[float, dict[str, pd.Series], set[str]]] = {}
PROXY_CONSTITUENTS = 10
RETURN_KEYS = ("ret_1w", "ret_1m", "ret_3m", "ret_ytd", "ret_1y")


def cached_history(key: str, symbols: list[str]) -> dict[str, pd.Series]:
    """1y daily closes, re-downloaded every HISTORY_REFRESH_MINUTES (or when the symbol set changes)."""
    hit = _history_cache.get(key)
    if hit and not set(symbols) <= hit[2]:
        hit = None
    if hit and time.time() - hit[0] < config.HISTORY_REFRESH_MINUTES * 60:
        return hit[1]
    history = download_history(symbols, period="1y")
    prev = _history_cache.get(key)
    if history or not prev:
        _history_cache[key] = (time.time(), history, set(symbols))
        return history
    return prev[1]  # download failed; keep serving the previous copy


def _pct(a, b):
    if a is None or b in (None, 0):
        return None
    return float((a / b - 1) * 100)


def history_stats(closes: pd.Series, price: float | None) -> dict:
    """Trailing returns + a downsampled sparkline from a daily close series."""
    last = price if price is not None else float(closes.iloc[-1])
    idx = closes.index
    def back(days):
        cutoff = idx[-1] - pd.Timedelta(days=days)
        s = closes[idx <= cutoff]
        return float(s.iloc[-1]) if len(s) else None
    year_start = closes[idx.year < idx[-1].year]
    spark = closes.iloc[-90:]
    return {
        "ret_1w": _pct(last, back(7)),
        "ret_1m": _pct(last, back(30)),
        "ret_3m": _pct(last, back(91)),
        "ret_ytd": _pct(last, float(year_start.iloc[-1]) if len(year_start) else None),
        "ret_1y": _pct(last, back(365)),
        "spark": [round(float(v), 4) for v in spark.values],
    }


def _summarise_sector(sector, rows: list[dict], index_row: dict | None) -> dict:
    valid = [r for r in rows if r.get("change_pct") is not None]
    adv = sum(1 for r in valid if r["change_pct"] > 0)
    dec = sum(1 for r in valid if r["change_pct"] < 0)
    total_cap = sum(r["market_cap"] or 0 for r in valid)
    weighted = (sum((r["market_cap"] or 0) * r["change_pct"] for r in valid) / total_cap) if total_cap else None
    avg = sum(r["change_pct"] for r in valid) / len(valid) if valid else None
    by_chg = sorted(valid, key=lambda r: r["change_pct"])
    brief = lambda r: {"symbol": r["symbol"], "name": r["name"], "change_pct": r["change_pct"], "price": r["price"]}
    return {
        "id": sector.id,
        "name": sector.name,
        "index_symbol": sector.index,
        "index": index_row,
        "count": len(rows),
        "advances": adv,
        "declines": dec,
        "unchanged": len(valid) - adv - dec,
        "avg_change_pct": avg,
        "weighted_change_pct": weighted,
        "total_market_cap": total_cap or None,
        "top_gainer": brief(by_chg[-1]) if by_chg else None,
        "top_loser": brief(by_chg[0]) if by_chg else None,
        "leaders": [brief(r) for r in rows[:5]],
    }


def build_snapshot(region: Region) -> dict:
    """Fetch everything for a region and assemble the API snapshot."""
    started = time.time()
    index_syms = region.index_symbols
    stock_syms = region.stock_symbols

    quotes = fetch_quotes(index_syms + stock_syms)
    history = cached_history(f"{region.id}:indices", index_syms)

    def instrument(sym: str, label: str | None = None) -> dict | None:
        q = quotes.get(sym)
        if q is None and sym not in history:
            return None
        row = dict(q) if q else {"symbol": sym, "name": sym, "price": float(history[sym].iloc[-1])}
        if label:
            row["name"] = label
        if sym in history and len(history[sym]) >= 5:
            row.update(history_stats(history[sym], row.get("price")))
        else:
            # Yahoo has no daily history for some NSE indices; use the values
            # this app has recorded at each refresh instead.
            recorded = [p["price"] for p in store.index_history(sym, 90) if p["price"] is not None]
            if row.get("price") is not None:
                recorded.append(row["price"])
            row["spark"] = recorded if len(recorded) >= 2 else []
            row["history_source"] = "refresh_log"
        return row

    indices = [r for s, n in region.indices if (r := instrument(s, n))]
    macro = [r for s, n in region.macro if (r := instrument(s, n))]

    sectors_summary, sector_rows = [], {}
    for sector in region.sectors:
        rows = [dict(quotes[s], sector=sector.id) for s in sector.symbols if s in quotes]
        rows.sort(key=lambda r: r.get("market_cap") or 0, reverse=True)
        for rank, r in enumerate(rows, 1):
            r["rank"] = rank
        sector_rows[sector.id] = rows
        idx_row = instrument(sector.index) if sector.index else None
        sectors_summary.append(_summarise_sector(sector, rows, idx_row))

    _attach_proxy_returns(region, sectors_summary, sector_rows)

    all_stocks = [r for rows in sector_rows.values() for r in rows if r.get("change_pct") is not None]
    def mover(r):
        return {k: r.get(k) for k in ("symbol", "name", "price", "change_pct", "volume", "market_cap", "sector")}
    movers = {
        "gainers": [mover(r) for r in sorted(all_stocks, key=lambda r: r["change_pct"], reverse=True)[:10]],
        "losers": [mover(r) for r in sorted(all_stocks, key=lambda r: r["change_pct"])[:10]],
        "active": [mover(r) for r in sorted(all_stocks, key=lambda r: (r.get("volume") or 0) * (r.get("price") or 0), reverse=True)[:10]],
        "near_high": [mover(r) for r in sorted((r for r in all_stocks if r.get("from_high_pct") is not None),
                                                key=lambda r: r["from_high_pct"], reverse=True)[:10]],
    }
    breadth = {
        "advances": sum(1 for r in all_stocks if r["change_pct"] > 0),
        "declines": sum(1 for r in all_stocks if r["change_pct"] < 0),
        "total": len(all_stocks),
    }
    bench = quotes.get(region.benchmark, {})

    log.info("%s snapshot: %d quotes, %d histories in %.1fs", region.id, len(quotes), len(history), time.time() - started)
    return {
        "region": region.id,
        "name": region.name,
        "currency": region.currency,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "market_state": bench.get("market_state"),
        "indices": indices,
        "macro": macro,
        "sectors": sectors_summary,
        "sector_rows": sector_rows,
        "movers": movers,
        "breadth": breadth,
        "missing": [s for s in stock_syms if s not in quotes],
    }


def _attach_proxy_returns(region: Region, summaries: list[dict], sector_rows: dict[str, list[dict]]):
    """For sectors whose index has no daily history on Yahoo, estimate 1W–1Y returns from
    the largest constituents (market-cap weighted) so the sector brief has trailing performance."""
    need = [s for s in summaries if not (s["index"] or {}).get("ret_1m")]
    top = {s["id"]: [r for r in sector_rows[s["id"]] if r.get("price")][:PROXY_CONSTITUENTS] for s in need}
    symbols = sorted({r["symbol"] for rows in top.values() for r in rows})
    if not symbols:
        return
    history = cached_history(f"{region.id}:proxy", symbols)
    for s in need:
        stats = [(r.get("market_cap") or 0, history_stats(history[r["symbol"]], r["price"]))
                 for r in top[s["id"]] if r["symbol"] in history and len(history[r["symbol"]]) >= 5]
        if not stats:
            continue
        out = {}
        for k in RETURN_KEYS:
            pairs = [(w, st[k]) for w, st in stats if st[k] is not None]
            total = sum(w for w, _ in pairs)
            out[k] = sum(w * v for w, v in pairs) / total if total else None
        s["proxy_returns"] = {**out, "constituents": len(stats)}


RANGES = {
    "1d": ("1d", "5m"), "5d": ("5d", "30m"), "1mo": ("1mo", "1d"), "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1d"), "ytd": ("ytd", "1d"), "1y": ("1y", "1d"), "5y": ("5y", "1wk"), "max": ("max", "1mo"),
}


def fetch_chart(symbol: str, range_: str) -> dict:
    period, interval = RANGES[range_]
    df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
    df = df.dropna(subset=["Close"])
    points = [
        {"t": ts.isoformat(), "o": _clean(float(r.Open)), "h": _clean(float(r.High)),
         "l": _clean(float(r.Low)), "c": float(r.Close), "v": _clean(float(r.Volume))}
        for ts, r in df.iterrows()
    ]
    return {"symbol": symbol, "range": range_, "interval": interval, "points": points}
