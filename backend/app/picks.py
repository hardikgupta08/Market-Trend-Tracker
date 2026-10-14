"""Daily stock picks: an analyst-consensus screen with technical stop losses.

* Rating, analyst count and price targets are the sell-side consensus published on
  Yahoo Finance (quoteSummary `financialData`). The target is the consensus mean
  12-month price target.
* Stop losses are NOT from analysts. They are computed here from each stock's recent
  volatility: entry − 3 × ATR(14), never more than 15% below entry.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pandas as pd

from . import config, market
from .universe import Region

log = logging.getLogger(__name__)

SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{}"

PREFILTER_RATING = 2.2     # quote-level rating used to shortlist candidates (1 = Strong Buy … 5 = Sell)
MAX_RATING = 2.0           # consensus required in the detailed check
MIN_ANALYSTS = {"india": 8, "world": 10}
MIN_UPSIDE, MAX_UPSIDE = 10.0, 60.0  # % to the mean target; very large gaps usually mean stale targets
CANDIDATES = 90
ATR_PERIOD, ATR_MULT, MAX_RISK = 14, 3.0, 15.0
MIN_RISK_REWARD = 1.5
MAX_PER_SECTOR = 2

METHODOLOGY = {
    "source": "Analyst consensus published on Yahoo Finance (rating, number of analysts, price targets)",
    "target": "Consensus mean 12-month analyst price target",
    "stop_loss": f"Computed by this app, not by analysts: entry − {ATR_MULT:g} × ATR({ATR_PERIOD}), "
                 f"capped at {MAX_RISK:g}% below entry",
    "screen": (f"Consensus Buy or better (≤ {MAX_RATING:g} on a 1–5 scale), enough covering analysts, "
               f"{MIN_UPSIDE:g}–{MAX_UPSIDE:g}% upside to the mean target, reward/risk ≥ {MIN_RISK_REWARD:g}, "
               f"at most {MAX_PER_SECTOR} per sector"),
    "horizon": "Analyst targets are 12-month views; the list is rebuilt daily before the market opens",
}


def _raw(d: dict, key: str):
    v = d.get(key)
    return v.get("raw") if isinstance(v, dict) else v


def fetch_consensus(symbols: list[str]) -> dict[str, dict]:
    data = market._get_yf_data()

    def one(sym: str):
        for attempt in range(2):
            try:
                res = data.get_raw_json(SUMMARY_URL.format(sym), params={"modules": "financialData"})
                fd = res["quoteSummary"]["result"][0]["financialData"]
                return sym, {
                    "target_mean": _raw(fd, "targetMeanPrice"),
                    "target_median": _raw(fd, "targetMedianPrice"),
                    "target_high": _raw(fd, "targetHighPrice"),
                    "target_low": _raw(fd, "targetLowPrice"),
                    "rating": _raw(fd, "recommendationMean"),
                    "rating_key": fd.get("recommendationKey"),
                    "analysts": _raw(fd, "numberOfAnalystOpinions"),
                }
            except Exception as exc:
                log.debug("consensus %s failed (attempt %d): %s", sym, attempt + 1, exc)
                time.sleep(1)
        return sym, None

    with ThreadPoolExecutor(max_workers=4) as pool:
        return {s: c for s, c in pool.map(one, symbols) if c}


def atr(frame: pd.DataFrame, period: int = ATR_PERIOD) -> float | None:
    if len(frame) <= period:
        return None
    prev = frame["Close"].shift(1)
    tr = pd.concat([frame["High"] - frame["Low"], (frame["High"] - prev).abs(), (frame["Low"] - prev).abs()],
                   axis=1).max(axis=1)
    value = float(tr.iloc[-period:].mean())
    return value if value > 0 else None


def _quote_rating(r: dict) -> float | None:
    raw = r.get("analyst_rating")
    try:
        return float(raw.split(" - ")[0]) if raw else None
    except ValueError:
        return None


def build_picks(region: Region, snap: dict) -> dict:
    started = time.time()
    rows = [r for rs in snap["sector_rows"].values() for r in rs
            if r.get("price") and (x := _quote_rating(r)) is not None and x <= PREFILTER_RATING]
    rows.sort(key=lambda r: r.get("market_cap") or 0, reverse=True)
    rows = rows[:CANDIDATES]
    consensus = fetch_consensus([r["symbol"] for r in rows])

    shortlist = []
    for r in rows:
        c = consensus.get(r["symbol"])
        if not c or not c["target_mean"] or c["rating"] is None:
            continue
        if c["rating"] > MAX_RATING or (c["analysts"] or 0) < MIN_ANALYSTS.get(region.id, 8):
            continue
        upside = (c["target_mean"] / r["price"] - 1) * 100
        if MIN_UPSIDE <= upside <= MAX_UPSIDE:
            shortlist.append((r, c, upside))

    ohlc = market.download_ohlc([r["symbol"] for r, _, _ in shortlist]) if shortlist else {}
    scored = []
    for r, c, upside in shortlist:
        frame = ohlc.get(r["symbol"])
        a = atr(frame) if frame is not None else None
        if a is None:
            continue
        entry = r["price"]
        stop = max(entry - ATR_MULT * a, entry * (1 - MAX_RISK / 100))
        risk = (entry - stop) / entry * 100
        rr = upside / risk
        if rr < MIN_RISK_REWARD:
            continue
        above_50 = r["price"] > r["sma_50"] if r.get("sma_50") else None
        above_200 = r["price"] > r["sma_200"] if r.get("sma_200") else None
        # Reward/risk, boosted by conviction (lower rating = stronger) and trend alignment.
        score = rr * (2.5 - c["rating"]) * (1.15 if above_200 else 0.85 if above_200 is False else 1.0)

        reasons = [f"{c['rating_key'].replace('_', ' ').title() if c['rating_key'] else 'Buy'} consensus "
                   f"({c['rating']:.2f}) from {c['analysts']} analysts",
                   f"{upside:.1f}% upside to the mean target"]
        if c["target_low"] and c["target_low"] > entry:
            reasons.append("Even the lowest analyst target is above the current price")
        if above_200 and above_50:
            reasons.append("Trading above its 50- and 200-day averages")
        elif above_200 is False:
            reasons.append("Below its 200-day average — counter-trend, respect the stop")

        scored.append((score, {
            "symbol": r["symbol"], "name": r["name"], "sector": r.get("sector"),
            "currency": r.get("currency"),
            "entry": round(entry, 2),
            "target": round(c["target_mean"], 2),
            "stop_loss": round(stop, 2),
            "target_high": c["target_high"], "target_low": c["target_low"],
            "upside_pct": upside, "risk_pct": risk, "risk_reward": rr,
            "rating": c["rating"], "rating_key": c["rating_key"], "analysts": c["analysts"],
            "atr": a, "above_50dma": above_50, "above_200dma": above_200,
            "market_cap": r.get("market_cap"), "pe": r.get("pe"),
            "reasons": reasons,
        }))

    scored.sort(key=lambda x: x[0], reverse=True)
    picks, per_sector = [], {}
    for _, p in scored:
        if per_sector.get(p["sector"], 0) >= MAX_PER_SECTOR:
            continue
        per_sector[p["sector"]] = per_sector.get(p["sector"], 0) + 1
        picks.append(p)
        if len(picks) >= config.PICKS_PER_REGION:
            break

    log.info("%s picks: %d candidates, %d with consensus, %d passed screen, %d picked in %.1fs",
             region.id, len(rows), len(consensus), len(scored), len(picks), time.time() - started)
    now = datetime.now(timezone.utc)
    return {
        "region": region.id,
        "generated_at": now.isoformat(),
        "prices_as_of": snap["updated_at"],
        "screened": len(rows),
        "passed": len(scored),
        "methodology": METHODOLOGY,
        "picks": picks,
    }


def with_live_prices(payload: dict, snap: dict | None) -> dict:
    """Attach current price and status (active / target reached / stop hit) to each pick."""
    live = {r["symbol"]: r for rs in (snap or {}).get("sector_rows", {}).values() for r in rs}
    out = []
    for p in payload["picks"]:
        q = live.get(p["symbol"], {})
        price = q.get("price")
        status = "active"
        if price is not None:
            if price >= p["target"]:
                status = "target_reached"
            elif price <= p["stop_loss"]:
                status = "stop_hit"
        out.append({**p, "price": price, "change_pct": q.get("change_pct"),
                    "since_entry_pct": (price / p["entry"] - 1) * 100 if price else None,
                    "status": status})
    return {**payload, "picks": out}
