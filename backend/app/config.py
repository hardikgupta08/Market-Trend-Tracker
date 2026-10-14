"""Runtime settings, overridable through environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "market.db"
YF_CACHE_DIR = DATA_DIR / "yf-cache"

# How often market data and news are refreshed.
REFRESH_INTERVAL_MINUTES = int(os.getenv("REFRESH_INTERVAL_MINUTES", "30"))
NEWS_INTERVAL_MINUTES = int(os.getenv("NEWS_INTERVAL_MINUTES", str(REFRESH_INTERVAL_MINUTES)))

# On-demand caches (charts, sector/company news).
CHART_CACHE_SECONDS = int(os.getenv("CHART_CACHE_SECONDS", "900"))
ONDEMAND_NEWS_CACHE_SECONDS = int(os.getenv("ONDEMAND_NEWS_CACHE_SECONDS", "1800"))

# Yahoo quote endpoint batch size.
QUOTE_BATCH_SIZE = 100

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# Built frontend (served by FastAPI in production if present).
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
