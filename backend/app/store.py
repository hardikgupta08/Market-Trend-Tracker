"""SQLite persistence: latest snapshots survive restarts, and index values are
appended on every refresh to build an intraday/refresh-level history."""
import json
import sqlite3
import threading
from contextlib import contextmanager

from . import config

_lock = threading.Lock()
LOG_KEEP = 2000


@contextmanager
def _conn():
    con = sqlite3.connect(config.DB_PATH, timeout=30)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    with _lock, _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS snapshots (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS index_history (
                symbol TEXT NOT NULL,
                ts TEXT NOT NULL,
                price REAL,
                change_pct REAL,
                PRIMARY KEY (symbol, ts)
            );
            CREATE TABLE IF NOT EXISTS refresh_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                ok INTEGER,
                detail TEXT
            );
        """)


def save_snapshot(key: str, data: dict, updated_at: str):
    with _lock, _conn() as con:
        con.execute("INSERT OR REPLACE INTO snapshots (key, data, updated_at) VALUES (?, ?, ?)",
                    (key, json.dumps(data), updated_at))


def load_snapshot(key: str) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT data FROM snapshots WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def append_index_history(rows: list[dict], ts: str):
    with _lock, _conn() as con:
        con.executemany(
            "INSERT OR REPLACE INTO index_history (symbol, ts, price, change_pct) VALUES (?, ?, ?, ?)",
            [(r["symbol"], ts, r.get("price"), r.get("change_pct")) for r in rows if r.get("price") is not None],
        )


def last_history_ts(symbols: list[str]) -> str | None:
    if not symbols:
        return None
    with _conn() as con:
        row = con.execute(
            f"SELECT MAX(ts) FROM index_history WHERE symbol IN ({','.join('?' * len(symbols))})", symbols
        ).fetchone()
    return row[0] if row else None


def index_history(symbol: str, limit: int = 500) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT ts, price, change_pct FROM index_history WHERE symbol = ? ORDER BY ts DESC LIMIT ?",
            (symbol, limit),
        ).fetchall()
    return [{"t": t, "price": p, "change_pct": c} for t, p, c in reversed(rows)]


def log_start(job: str, started_at: str) -> int:
    with _lock, _conn() as con:
        cur = con.execute("INSERT INTO refresh_log (job, started_at) VALUES (?, ?)", (job, started_at))
        return cur.lastrowid


def log_finish(log_id: int, finished_at: str, ok: bool, detail: str = ""):
    with _lock, _conn() as con:
        con.execute("UPDATE refresh_log SET finished_at = ?, ok = ?, detail = ? WHERE id = ?",
                    (finished_at, int(ok), detail[:2000], log_id))
        # Jobs run every minute; keep only the most recent entries.
        con.execute("DELETE FROM refresh_log WHERE id <= ?", (log_id - LOG_KEEP,))


def recent_log(limit: int = 20) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT job, started_at, finished_at, ok, detail FROM refresh_log ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(zip(("job", "started_at", "finished_at", "ok", "detail"), r)) for r in rows]
