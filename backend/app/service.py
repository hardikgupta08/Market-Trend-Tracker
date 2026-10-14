"""In-memory state, refresh jobs (markets + news every minute, picks daily) and the scheduler."""
from __future__ import annotations

import logging
import threading
import time
import traceback
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from . import analysis, config, market, news, picks, store
from .universe import REGIONS

log = logging.getLogger(__name__)

_snapshots: dict[str, dict] = {}
_news: dict[str, dict] = {}
_picks: dict[str, dict] = {}
_picks_attempted: dict[str, float] = {}
_running: set[str] = set()
_state_lock = threading.Lock()
_refresh_locks = {name: threading.Lock() for name in ("markets", "news", *(f"picks:{rid}" for rid in REGIONS))}

scheduler = BackgroundScheduler(timezone="UTC", job_defaults={"coalesce": True, "max_instances": 1})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- startup ----------

def load_persisted():
    store.init()
    for rid in REGIONS:
        if snap := store.load_snapshot(f"market:{rid}"):
            _snapshots[rid] = snap
        if items := store.load_snapshot(f"news:{rid}"):
            _news[rid] = items
        if p := store.load_snapshot(f"picks:{rid}"):
            _picks[rid] = p
    log.info("loaded persisted snapshots: %s", list(_snapshots))


def start_scheduler():
    first = datetime.now(timezone.utc)
    scheduler.add_job(refresh_markets, "interval", minutes=config.REFRESH_INTERVAL_MINUTES,
                      id="markets", next_run_time=first)
    scheduler.add_job(refresh_news, "interval", minutes=config.NEWS_INTERVAL_MINUTES,
                      id="news", next_run_time=first)
    scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)


# ---------- jobs ----------

def _run_job(name: str, fn):
    lock = _refresh_locks[name]
    if not lock.acquire(blocking=False):
        log.info("%s refresh already running; skipped", name)
        return False
    _running.add(name)
    log_id = store.log_start(name, _now())
    t0 = time.time()
    try:
        detail = fn()
        store.log_finish(log_id, _now(), True, f"{detail} in {time.time() - t0:.1f}s")
        return True
    except Exception:
        log.exception("%s refresh failed", name)
        store.log_finish(log_id, _now(), False, traceback.format_exc())
        return False
    finally:
        _running.discard(name)
        lock.release()


def refresh_markets():
    def work():
        parts = []
        for rid, region in REGIONS.items():
            snap = market.build_snapshot(region)
            with _state_lock:
                _snapshots[rid] = snap
            store.save_snapshot(f"market:{rid}", snap, snap["updated_at"])
            _record_history(snap)
            if picks_due(rid):
                threading.Thread(target=refresh_picks, args=(rid,), daemon=True).start()
            parts.append(f"{rid}: {sum(len(v) for v in snap['sector_rows'].values())} stocks")
        return "; ".join(parts)
    return _run_job("markets", work)


def _record_history(snap: dict):
    """Append index values at most every HISTORY_SAMPLE_MINUTES (refreshes run every minute)."""
    rows = snap["indices"] + snap["macro"]
    last = store.last_history_ts([r["symbol"] for r in rows])
    if last and datetime.fromisoformat(snap["updated_at"]) - datetime.fromisoformat(last) < timedelta(
            minutes=config.HISTORY_SAMPLE_MINUTES):
        return
    store.append_index_history(rows, snap["updated_at"])


def _last_scheduled_picks(rid: str, now: datetime) -> datetime:
    hh, mm = map(int, config.PICKS_SCHEDULE_UTC[rid].split(":"))
    slot = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return slot if slot <= now else slot - timedelta(days=1)


def picks_due(rid: str) -> bool:
    """True when the region's picks predate its most recent daily slot (also covers
    first start and a server that slept through the slot). Retries back off 30 min."""
    if time.time() - _picks_attempted.get(rid, 0) < 1800:
        return False
    current = _picks.get(rid)
    if not current:
        return True
    now = datetime.now(timezone.utc)
    return datetime.fromisoformat(current["generated_at"]) < _last_scheduled_picks(rid, now)


def refresh_picks(rid: str):
    _picks_attempted[rid] = time.time()

    def work():
        snap = _snapshots.get(rid)
        if snap is None:
            raise RuntimeError(f"no market snapshot for {rid} yet")
        payload = picks.build_picks(REGIONS[rid], snap)
        with _state_lock:
            _picks[rid] = payload
        store.save_snapshot(f"picks:{rid}", payload, payload["generated_at"])
        return f"{rid}: {len(payload['picks'])} picks from {payload['screened']} candidates"
    return _run_job(f"picks:{rid}", work)


def refresh_news():
    def work():
        parts = []
        for rid, region in REGIONS.items():
            items = news.fetch_feeds(region.news_feeds)
            payload = {"region": rid, "updated_at": _now(), "items": items}
            with _state_lock:
                _news[rid] = payload
            store.save_snapshot(f"news:{rid}", payload, payload["updated_at"])
            parts.append(f"{rid}: {len(items)} items")
        return "; ".join(parts)
    return _run_job("news", work)


def trigger_refresh():
    """Kick off both refreshes in the background (used by POST /api/refresh)."""
    threading.Thread(target=refresh_markets, daemon=True).start()
    threading.Thread(target=refresh_news, daemon=True).start()


# ---------- reads ----------

def snapshot(region: str) -> dict | None:
    return _snapshots.get(region)


def market_news(region: str) -> dict | None:
    return _news.get(region)


def sector_briefs(region: str) -> dict | None:
    snap = _snapshots.get(region)
    if snap is None:
        return None
    return cached(f"briefs:{region}:{snap['updated_at']}", 3600,
                  lambda: analysis.build_briefs(REGIONS[region], snap))


def stock_picks(region: str) -> dict | None:
    payload = _picks.get(region)
    return picks.with_live_prices(payload, _snapshots.get(region)) if payload else None


def status() -> dict:
    jobs = {j.id: j.next_run_time.isoformat() if j.next_run_time else None for j in scheduler.get_jobs()}
    return {
        "server_time": _now(),
        "refresh_interval_minutes": config.REFRESH_INTERVAL_MINUTES,
        "news_interval_minutes": config.NEWS_INTERVAL_MINUTES,
        "picks_schedule_utc": config.PICKS_SCHEDULE_UTC,
        "running": sorted(_running),
        "next_run": jobs,
        "regions": {
            rid: {
                "updated_at": (_snapshots.get(rid) or {}).get("updated_at"),
                "news_updated_at": (_news.get(rid) or {}).get("updated_at"),
                "market_state": (_snapshots.get(rid) or {}).get("market_state"),
                "picks_generated_at": (_picks.get(rid) or {}).get("generated_at"),
            }
            for rid in REGIONS
        },
        "recent_jobs": store.recent_log(10),
    }


# ---------- small TTL cache for on-demand data ----------

_cache: dict[str, tuple[float, object]] = {}
_cache_lock = threading.Lock()


def cached(key: str, ttl: int, fn):
    with _cache_lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]
    value = fn()
    with _cache_lock:
        _cache[key] = (time.time(), value)
        if len(_cache) > 2000:  # crude bound
            for k in sorted(_cache, key=lambda k: _cache[k][0])[:500]:
                _cache.pop(k, None)
    return value
