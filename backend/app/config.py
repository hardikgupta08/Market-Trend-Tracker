"""Runtime settings, overridable through environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "market.db"
YF_CACHE_DIR = DATA_DIR / "yf-cache"

# How often market data and news are refreshed.
REFRESH_INTERVAL_MINUTES = int(os.getenv("REFRESH_INTERVAL_MINUTES", "1"))
NEWS_INTERVAL_MINUTES = int(os.getenv("NEWS_INTERVAL_MINUTES", "5"))

# Outside a region's trading session, or when nobody has used the site for IDLE_MINUTES,
# data is refreshed only every SLOW_REFRESH_MINUTES. This keeps a small (shared-CPU) host
# free to answer requests instead of re-downloading ~1,300 unchanged quotes every minute.
SLOW_REFRESH_MINUTES = int(os.getenv("SLOW_REFRESH_MINUTES", "15"))
IDLE_MINUTES = int(os.getenv("IDLE_MINUTES", "10"))
# Keep-alive: ping our own public URL so free hosts that sleep after ~15 idle minutes
# (Render) stay awake. Render sets RENDER_EXTERNAL_URL automatically; unset locally = disabled.
KEEP_ALIVE_URL = os.getenv("KEEP_ALIVE_URL") or os.getenv("RENDER_EXTERNAL_URL")
KEEP_ALIVE_MINUTES = int(os.getenv("KEEP_ALIVE_MINUTES", "10"))

# Local trading window per region (exchange time zone, weekdays), padded for pre/post-market.
SESSIONS = {
    "india": ("Asia/Kolkata", "09:00", "15:45"),
    "world": ("America/New_York", "04:00", "20:00"),
}

# Daily index closes (for 1W/1M/YTD returns and sparklines) change slowly, so they
# are re-downloaded less often than the live quotes.
HISTORY_REFRESH_MINUTES = int(os.getenv("HISTORY_REFRESH_MINUTES", "30"))
# Minimum spacing between index values recorded to the refresh-level history table.
HISTORY_SAMPLE_MINUTES = int(os.getenv("HISTORY_SAMPLE_MINUTES", "30"))

# Daily stock picks: UTC times (HH:MM) the screen runs for each region —
# before the NSE open (09:15 IST) and before the US open (09:30 ET).
PICKS_SCHEDULE_UTC = {
    "india": os.getenv("PICKS_INDIA_UTC", "02:45"),
    "world": os.getenv("PICKS_WORLD_UTC", "12:30"),
}
PICKS_PER_REGION = int(os.getenv("PICKS_PER_REGION", "12"))

# Startup ordering: market snapshots first, then news, then the (heavy) picks screen.
NEWS_STARTUP_DELAY_SECONDS = int(os.getenv("NEWS_STARTUP_DELAY_SECONDS", "15"))
PICKS_STARTUP_DELAY_SECONDS = int(os.getenv("PICKS_STARTUP_DELAY_SECONDS", "120"))

# On-demand caches (charts, sector/company news).
CHART_CACHE_SECONDS = int(os.getenv("CHART_CACHE_SECONDS", "900"))
INTRADAY_CHART_CACHE_SECONDS = int(os.getenv("INTRADAY_CHART_CACHE_SECONDS", "60"))
ONDEMAND_NEWS_CACHE_SECONDS = int(os.getenv("ONDEMAND_NEWS_CACHE_SECONDS", "60"))

# Yahoo quote endpoint batch size.
QUOTE_BATCH_SIZE = 100

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# Built frontend (served by FastAPI in production if present).
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
