"""Sector briefs: performance, trend, valuation and sentiment signals per sector,
computed from the live market snapshot, plus curated drivers to watch."""
from __future__ import annotations

from statistics import median

from .sector_watch import WATCH
from .universe import Region

RET_KEYS = ("ret_1w", "ret_1m", "ret_3m", "ret_ytd", "ret_1y")

# Stance thresholds on the composite score (-100 … +100).
STANCES = [(40, "Bullish"), (15, "Positive"), (-15, "Neutral"), (-40, "Cautious")]


def _clamp(v: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _med(values) -> float | None:
    vals = [v for v in values if v is not None]
    return median(vals) if vals else None


def _share(rows: list[dict], pred) -> float | None:
    """Percentage of rows satisfying pred, ignoring rows where pred returns None."""
    hits = [pred(r) for r in rows]
    hits = [h for h in hits if h is not None]
    return 100 * sum(hits) / len(hits) if hits else None


def _rating(r: dict) -> float | None:
    raw = r.get("analyst_rating")
    try:
        return float(raw.split(" - ")[0]) if raw else None
    except ValueError:
        return None


def _cap_weighted(rows: list[dict], key: str) -> float | None:
    pairs = [(r.get("market_cap") or 0, r[key]) for r in rows if r.get(key) is not None]
    total = sum(w for w, _ in pairs)
    return sum(w * v for w, v in pairs) / total if total else None


def _stance(score: float) -> str:
    for threshold, label in STANCES:
        if score >= threshold:
            return label
    return "Bearish"


def _fmt(v: float, digits: int = 1) -> str:
    return f"{v:+.{digits}f}%"


def build_briefs(region: Region, snap: dict) -> dict:
    bench = next((i for i in snap["indices"] if i["symbol"] == region.benchmark), None) or {}
    all_rows = [r for rows in snap["sector_rows"].values() for r in rows]
    market_pe = _med(r.get("pe") for r in all_rows if (r.get("pe") or 0) > 0)
    watch = WATCH.get(region.id, {})

    briefs = []
    for summary in snap["sectors"]:
        rows = snap["sector_rows"].get(summary["id"], [])
        if not rows:
            continue
        index = summary.get("index") or {}

        # Returns: the sector index where Yahoo has its history, else the largest constituents.
        perf = {"day": summary.get("weighted_change_pct")}
        proxy = summary.get("proxy_returns")
        if index.get("ret_1m") is not None:
            perf_source = index.get("name") or summary.get("index_symbol")
            perf.update({k: index.get(k) for k in RET_KEYS})
        elif proxy:
            perf_source = f"Top {proxy['constituents']} stocks by market cap, cap-weighted"
            perf.update({k: proxy.get(k) for k in RET_KEYS})
        else:
            perf_source = "Constituents' 52-week change, cap-weighted"
            perf.update({k: None for k in RET_KEYS})
            perf["ret_1y"] = _cap_weighted(rows, "change_52w_pct")
        rel = {k: (perf[k] - bench[k]) if perf.get(k) is not None and bench.get(k) is not None else None
               for k in ("ret_1m", "ret_3m", "ret_1y")}

        priced = [r for r in rows if r.get("price")]
        above_50 = _share(priced, lambda r: r["price"] > r["sma_50"] if r.get("sma_50") else None)
        above_200 = _share(priced, lambda r: r["price"] > r["sma_200"] if r.get("sma_200") else None)
        near_high = _share(priced, lambda r: r["from_high_pct"] >= -5 if r.get("from_high_pct") is not None else None)
        from_high = _med(r.get("from_high_pct") for r in priced)

        pe = _med(r.get("pe") for r in rows if (r.get("pe") or 0) > 0)
        fpe = _med(r.get("forward_pe") for r in rows if (r.get("forward_pe") or 0) > 0)
        # Share of stocks whose forward P/E is above trailing, i.e. earnings expected to fall.
        eps_decline = _share(rows, lambda r: r["forward_pe"] > r["pe"]
                             if (r.get("pe") or 0) > 0 and (r.get("forward_pe") or 0) > 0 else None)
        ratings = [x for r in rows if (x := _rating(r)) is not None]
        buy_share = 100 * sum(1 for x in ratings if x <= 2.5) / len(ratings) if ratings else None

        # Composite: long-term trend, short-term momentum, relative strength, drawdown.
        parts = []
        if above_200 is not None:
            parts.append((0.35, (above_200 - 50) / 50))
        if above_50 is not None:
            parts.append((0.25, (above_50 - 50) / 50))
        rs = rel["ret_3m"] if rel["ret_3m"] is not None else rel["ret_1y"]
        if rs is not None:
            parts.append((0.25, _clamp(rs / 10)))
        if from_high is not None:
            parts.append((0.15, _clamp((from_high + 15) / 15)))
        weight = sum(w for w, _ in parts)
        score = round(100 * sum(w * v for w, v in parts) / weight) if weight else 0

        signals = _signals(
            bench_name=bench.get("name") or region.benchmark,
            adv=summary["advances"], dec=summary["declines"],
            above_50=above_50, above_200=above_200, near_high=near_high, from_high=from_high,
            rel=rel, pe=pe, market_pe=market_pe, eps_decline=eps_decline, buy_share=buy_share,
        )

        by_52w = sorted((r for r in rows if r.get("change_52w_pct") is not None),
                        key=lambda r: r["change_52w_pct"], reverse=True)
        brief = lambda r: {"symbol": r["symbol"], "name": r["name"], "price": r.get("price"),
                           "change_pct": r.get("change_pct"), "change_52w_pct": r.get("change_52w_pct")}
        stance = _stance(score)
        briefs.append({
            "id": summary["id"],
            "name": summary["name"],
            "index_symbol": summary.get("index_symbol"),
            "count": len(rows),
            "stance": stance,
            "score": score,
            "headline": _headline(summary["name"], stance, perf, above_200, rel),
            "performance": perf,
            "performance_source": perf_source,
            "relative": rel,
            "breadth": {
                "advances": summary["advances"], "declines": summary["declines"],
                "above_50dma_pct": above_50, "above_200dma_pct": above_200,
                "near_high_pct": near_high, "median_from_high_pct": from_high,
            },
            "valuation": {
                "median_pe": pe, "median_forward_pe": fpe, "eps_decline_pct": eps_decline,
                "median_pb": _med(r.get("pb") for r in rows if (r.get("pb") or 0) > 0),
                "median_dividend_yield": _med(r.get("dividend_yield") for r in rows),
                "market_median_pe": market_pe,
            },
            "sentiment": {"avg_rating": sum(ratings) / len(ratings) if ratings else None,
                          "buy_share_pct": buy_share, "rated": len(ratings)},
            "signals": signals,
            "watch": watch.get(summary["id"], []),
            "leaders_1y": [brief(r) for r in by_52w[:3]],
            "laggards_1y": [brief(r) for r in by_52w[-3:][::-1]] if len(by_52w) > 3 else [],
        })

    briefs.sort(key=lambda b: b["score"], reverse=True)
    return {
        "region": region.id,
        "updated_at": snap["updated_at"],
        "benchmark": {"symbol": region.benchmark, "name": bench.get("name"),
                      **{k: bench.get(k) for k in ("change_pct", *RET_KEYS)}},
        "briefs": briefs,
    }


def _headline(name: str, stance: str, perf: dict, above_200: float | None, rel: dict) -> str:
    bits = []
    if perf.get("ret_1m") is not None:
        bits.append(f"{_fmt(perf['ret_1m'])} over 1 month")
    elif perf.get("ret_1y") is not None:
        bits.append(f"{_fmt(perf['ret_1y'])} over 1 year")
    if above_200 is not None:
        bits.append(f"{above_200:.0f}% of stocks above their 200-day average")
    lead = {"Bullish": "in a strong uptrend", "Positive": "trending higher", "Neutral": "range-bound",
            "Cautious": "losing momentum", "Bearish": "in a downtrend"}[stance]
    return f"{name} is {lead}" + (f": {', '.join(bits)}." if bits else ".")


def _signals(*, bench_name, adv, dec, above_50, above_200, near_high, from_high, rel,
             pe, market_pe, eps_decline, buy_share) -> list[dict]:
    out: list[dict] = []

    def add(tone: str, text: str):
        out.append({"tone": tone, "text": text})

    if above_200 is not None:
        if above_200 >= 70:
            add("pos", f"{above_200:.0f}% of stocks trade above their 200-day average — a broad long-term uptrend")
        elif above_200 <= 30:
            add("neg", f"Only {above_200:.0f}% of stocks are above their 200-day average — long-term trend is weak")
    if above_50 is not None and above_200 is not None:
        if above_50 >= above_200 + 20:
            add("pos", f"Short-term momentum improving: {above_50:.0f}% above 50-DMA vs {above_200:.0f}% above 200-DMA")
        elif above_50 <= above_200 - 20:
            add("neg", f"Short-term momentum fading: {above_50:.0f}% above 50-DMA vs {above_200:.0f}% above 200-DMA")

    for key, label in (("ret_1m", "1 month"), ("ret_3m", "3 months")):
        r = rel.get(key)
        if r is not None and abs(r) >= 3:
            word = "Outperforming" if r > 0 else "Underperforming"
            add("pos" if r > 0 else "neg", f"{word} {bench_name} by {abs(r):.1f} pts over {label}")
            break

    if near_high is not None and near_high >= 40:
        add("pos", f"{near_high:.0f}% of stocks are within 5% of their 52-week high")
    elif from_high is not None and from_high <= -25:
        add("neg", f"Median stock is {abs(from_high):.0f}% below its 52-week high — deep drawdown")

    if eps_decline is not None and eps_decline >= 40:
        add("neg", f"Analysts expect lower earnings for {eps_decline:.0f}% of the sector (forward P/E above trailing)")
    if pe and market_pe:
        prem = pe / market_pe
        if prem >= 1.3:
            add("neu", f"Valuation premium: median P/E {pe:.1f} vs {market_pe:.1f} for the whole market")
        elif prem <= 0.75:
            add("neu", f"Valuation discount: median P/E {pe:.1f} vs {market_pe:.1f} for the whole market")

    if adv + dec >= 5:
        up = adv / (adv + dec)
        if up >= 0.75:
            add("pos", f"Broad buying today: {adv} advancing vs {dec} declining")
        elif up <= 0.25:
            add("neg", f"Broad selling today: {dec} declining vs {adv} advancing")

    if buy_share is not None:
        if buy_share >= 70:
            add("pos", f"Analysts are constructive: {buy_share:.0f}% of rated stocks carry a Buy consensus")
        elif buy_share <= 30:
            add("neg", f"Analysts are cautious: only {buy_share:.0f}% of rated stocks carry a Buy consensus")

    if not out:
        add("neu", "No strong signals — trend, momentum and relative performance are all middling")
    return out
