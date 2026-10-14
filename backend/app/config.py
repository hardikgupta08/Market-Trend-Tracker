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
NEWS_INTERVAL_MINUTES = int(os.getenv("NEWS_INTERVAL_MINUTES", str(REFRESH_INTERVAL_MINUTES)))

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
