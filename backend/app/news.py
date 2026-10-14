"""News aggregation from public RSS feeds (publisher feeds + Google News search)."""
from __future__ import annotations

import html
import logging
import re
from calendar import timegm
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlencode

import feedparser

log = logging.getLogger(__name__)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketTerminal/1.0"
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _text(s: str | None, limit: int = 280) -> str:
    s = _WS_RE.sub(" ", _TAG_RE.sub(" ", html.unescape(s or ""))).strip()
    return s if len(s) <= limit else s[:limit].rsplit(" ", 1)[0] + "…"


def _parse_feed(source: str, url: str) -> list[dict]:
    try:
        feed = feedparser.parse(url, agent=UA)
    except Exception as exc:
        log.warning("feed %s failed: %s", source, exc)
        return []
    items = []
    for e in feed.entries:
        title = _text(e.get("title"), 300)
        if not title:
            continue
        publisher = source
        # Google News titles look like "Headline - Publisher".
        if "news.google.com" in url:
            src = e.get("source", {}).get("title") if isinstance(e.get("source"), dict) else None
            if src:
                publisher = src
                title = title.removesuffix(f" - {src}")
        ts = e.get("published_parsed") or e.get("updated_parsed")
        published = datetime.fromtimestamp(timegm(ts), timezone.utc).isoformat() if ts else None
        summary = _text(e.get("summary"))
        if summary.startswith(title[:40]):  # Google News summaries just repeat the title
            summary = ""
        items.append({
            "title": title,
            "link": e.get("link"),
            "source": publisher,
            "published": published,
            "summary": summary,
        })
    return items


def _dedupe_sort(items: list[dict], limit: int) -> list[dict]:
    seen, out = set(), []
    for it in sorted(items, key=lambda x: x["published"] or "", reverse=True):
        key = re.sub(r"[^a-z0-9]", "", it["title"].lower())[:80]
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out[:limit]


def fetch_feeds(feeds: list[tuple[str, str]], limit: int = 120) -> list[dict]:
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = pool.map(lambda f: _parse_feed(*f), feeds)
    return _dedupe_sort([i for r in results for i in r], limit)


def google_news(query: str, locale: dict, limit: int = 40) -> list[dict]:
    url = "https://news.google.com/rss/search?" + urlencode({"q": f"{query} when:7d", **locale})
    return _dedupe_sort(_parse_feed("Google News", url), limit)
