# Market Terminal: India & World Index / Sector Tracker

A full-stack market dashboard with:

- **India tab**: NIFTY 50, SENSEX, Bank / IT / sectoral NIFTY indices, India VIX, USD/INR, commodities,
  and **15 sectors with ~30–60 companies each** (~690 NSE stocks), ranked by market cap.
- **World tab**: US, European and Asian indices, rates, FX, commodities and crypto, and the
  **11 GICS sectors with ~30–60 companies each** (~500 US-listed / global ADR stocks).
- **Sector heatmap**: market-cap-weighted, equal-weight or sector-index change, with advance/decline breadth.
- **Company tables**: price, change, market cap, P/E, P/B, dividend yield, 52-week range, volume and analyst consensus. Sortable and filterable.
- **Movers**: top gainers, losers, most active (by traded value) and stocks nearest their 52-week high.
- **News column**: market news (Economic Times, Mint, Business Standard, Moneycontrol, CNBC, MarketWatch,
  Google News), plus per-sector and per-company news.
- **Detail drawer**: interactive price chart (1D → MAX), key stats and company headlines.
- **Sector Brief view**: every sector ranked by a composite trend score (Bullish → Bearish), with 1D–1Y
  performance vs the benchmark, % of stocks above their 50/200-day averages, valuation (P/E, P/B, yield),
  analyst sentiment, auto-generated signals, a curated "what to watch" outlook and the latest sector headlines.
- **Stock Picks view**: a daily screen of Buy-rated large caps using the analyst consensus published on Yahoo
  Finance. Each pick shows entry, consensus mean target, a **computed** stop loss (entry − 3×ATR(14), max 15%),
  reward/risk and live status (active / target reached / stop hit). Rebuilt daily before each market opens.
- **Prices refresh every minute while a market is open and someone is viewing** (every 15 min otherwise), news every
  5 min (all configurable), persisted to SQLite so restarts serve the last snapshot instantly.

```
backend/   FastAPI + yfinance + feedparser + APScheduler + SQLite
frontend/  React 19 + TypeScript + Vite (no UI/chart libraries — hand-rolled SVG charts)
```

## Quick start (Windows)

Prerequisites: Python 3.10+ and Node.js 18+ on PATH. Then run one command:

```powershell
.\run.bat          # or: .\run.ps1
```

Open http://localhost:8000. The script is safe to rerun: it creates the Python venv and installs
dependencies only when missing or changed, and rebuilds the frontend only when its sources changed.
Then it serves the API and UI from a single process. Press Ctrl+C to stop.

| Option | Effect |
|---|---|
| `-Open` | Open the browser once the server is up |
| `-Dev` | Hot-reload mode: API auto-reload + Vite dev server at http://localhost:5173, same window |
| `-Port 9000` | Use a different API port (default 8000) |
| `-RefreshMinutes 5` | Change the data refresh interval (default 1) |
| `-Setup` | Force a reinstall of all dependencies |

`run.bat` passes the same options (e.g. `run.bat -Dev -Open`) and bypasses PowerShell's script execution
policy, so it also works from cmd or by double-clicking.

The first refresh runs immediately on startup and takes about 15 seconds; later refreshes take ~5 seconds
because index history is cached. The first set of stock picks is screened right after (about 15 seconds more). Until it finishes, the UI shows a loading state.

## Deploying (Render)

The repo includes a `Dockerfile` (builds the UI, serves API + UI from one process on `$PORT`) and a
`render.yaml` blueprint. On [Render](https://render.com): **New → Blueprint**, pick this repo, and apply.
Pushes to `main` redeploy automatically.

On the free plan Render puts a service to sleep after 15 minutes without traffic. To prevent that, the app
pings its own public `/api/health` every 10 minutes (Render sets `RENDER_EXTERNAL_URL`
automatically, so this needs no setup). One always-on service fits inside the free plan's 750
instance-hours a month. Keep-alive pings don't count as visitors, so while nobody has the page open
the server refreshes only every 15 minutes and stays light. Optionally, add a free uptime monitor
(e.g. [UptimeRobot](https://uptimerobot.com)) on the same URL as a backup and for downtime alerts.

For more CPU (and no reliance on keep-alive pings), switch `plan: free` to `plan: starter` in `render.yaml`.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `REFRESH_INTERVAL_MINUTES` | `1` | Market-data refresh interval |
| `NEWS_INTERVAL_MINUTES` | `5` | Market-news refresh interval |
| `SLOW_REFRESH_MINUTES` | `15` | Refresh interval when a market is closed or nobody is viewing |
| `IDLE_MINUTES` | `10` | Minutes without a visitor (health checks excluded) before refreshes slow down |
| `HISTORY_REFRESH_MINUTES` | `30` | How often daily index/constituent history is re-downloaded |
| `HISTORY_SAMPLE_MINUTES` | `30` | Spacing of index values recorded to the refresh-level history |
| `PICKS_INDIA_UTC` / `PICKS_WORLD_UTC` | `02:45` / `12:30` | Daily stock-pick screen time (UTC) per region |
| `PICKS_PER_REGION` | `12` | Number of stock picks per region |
| `CHART_CACHE_SECONDS` | `900` | Cache for on-demand price charts (daily+ ranges) |
| `INTRADAY_CHART_CACHE_SECONDS` | `60` | Cache for 1D / 5D charts |
| `ONDEMAND_NEWS_CACHE_SECONDS` | `60` | Cache for sector / company news |
| `KEEP_ALIVE_URL` | `$RENDER_EXTERNAL_URL` | Public URL to ping so the host doesn't sleep (unset = disabled) |
| `KEEP_ALIVE_MINUTES` | `10` | Keep-alive ping interval |
| `DATA_DIR` | `backend/data` | SQLite DB + yfinance cache location |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `VITE_API_BASE` (frontend) | `""` | API origin if the UI is hosted separately |

## REST API

Interactive docs: http://localhost:8000/docs

| Method & path | Description |
|---|---|
| `GET /api/status` | Last update per region, next scheduled run, recent job log |
| `POST /api/refresh` | Trigger an immediate refresh (runs in background) |
| `GET /api/regions` | Regions and their sector definitions |
| `GET /api/markets/{india\|world}/overview` | Indices, macro, sector summaries, movers, breadth |
| `GET /api/markets/{region}/indices` | Indices + macro instruments with 1W/1M/3M/YTD/1Y returns and sparklines |
| `GET /api/markets/{region}/sectors` | Sector summaries |
| `GET /api/markets/{region}/sectors/{id}` | All companies in a sector, ranked by market cap |
| `GET /api/markets/{region}/movers` | Gainers, losers, most active, near 52W high |
| `GET /api/markets/{region}/briefs` | Sector briefs: score, stance, performance, breadth, valuation, signals, outlook |
| `GET /api/markets/{region}/picks` | Today's analyst-consensus picks with target, stop loss and live status |
| `GET /api/stocks/{symbol}` | Full quote for one symbol (e.g. `RELIANCE.NS`, `AAPL`) |
| `GET /api/chart/{symbol}?range=1d\|5d\|1mo\|3mo\|6mo\|ytd\|1y\|5y\|max` | OHLCV series |
| `GET /api/history/{symbol}` | Index values recorded at each scheduled refresh |
| `GET /api/news?region=&sector=&symbol=&limit=` | Market, sector or company news |
| `GET /api/search?q=` | Search companies by ticker or name across both regions |

## Customising the universe

Sector membership lives in `backend/app/universe_india.py` and `backend/app/universe_world.py`. Each sector
is a list of tickers. Names, market caps and fundamentals are pulled live, so adding a company only needs its
ticker (NSE symbol for India; `.NS` is appended automatically). Symbols Yahoo doesn't recognise are skipped and
listed under `missing` in the overview snapshot.

## Notes & limitations

- Data comes from Yahoo Finance's public endpoints via `yfinance`. It is free and unofficial, may be delayed
  (~15 min for NSE) and can change without notice. For production use, swap `market.py` for a licensed feed.
- Yahoo has **no price history** for several NSE sectoral indices (e.g. NIFTY Auto, FMCG, Metal, Midcap 100).
  Their current value and day change are correct. For those, sparklines and charts use the values this app
  records at every refresh, so they fill in over time, and Yahoo's unreliable 52-week stats are hidden.
- Stock-pick targets are sell-side consensus 12-month targets as published by Yahoo Finance. Stop losses are a
  mechanical volatility rule computed by this app, not analyst recommendations. Sector "what to watch" lists are
  curated in `backend/app/sector_watch.py`; the signals and scores are computed from live data.
- Not investment advice.
