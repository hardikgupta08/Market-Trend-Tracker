"""Normalised access to the regional universes."""
from dataclasses import dataclass, field

from . import universe_india, universe_world


@dataclass
class Sector:
    id: str
    name: str
    index: str | None
    news_query: str
    symbols: list[str]


@dataclass
class Region:
    id: str
    name: str
    currency: str
    indices: list[tuple[str, str]]
    macro: list[tuple[str, str]]
    sectors: list[Sector]
    news_feeds: list[tuple[str, str]]
    news_locale: dict
    benchmark: str
    sector_by_id: dict[str, Sector] = field(default_factory=dict)

    def __post_init__(self):
        self.sector_by_id = {s.id: s for s in self.sectors}

    @property
    def index_symbols(self) -> list[str]:
        syms = [s for s, _ in self.indices] + [s for s, _ in self.macro]
        syms += [s.index for s in self.sectors if s.index]
        return list(dict.fromkeys(syms))

    @property
    def stock_symbols(self) -> list[str]:
        return list(dict.fromkeys(sym for s in self.sectors for sym in s.symbols))


def _build_sectors(module) -> list[Sector]:
    out = []
    for raw in module.SECTORS:
        symbols = [f"{t}{module.SUFFIX}" for t in raw["symbols"].split()]
        out.append(Sector(raw["id"], raw["name"], raw["index"], raw["news_query"],
                          list(dict.fromkeys(symbols))))
    return out


REGIONS: dict[str, Region] = {
    "india": Region(
        id="india", name="India", currency="INR",
        indices=universe_india.INDICES, macro=universe_india.MACRO,
        sectors=_build_sectors(universe_india),
        news_feeds=universe_india.NEWS_FEEDS, news_locale=universe_india.NEWS_LOCALE,
        benchmark="^NSEI",
    ),
    "world": Region(
        id="world", name="World", currency="USD",
        indices=universe_world.INDICES, macro=universe_world.MACRO,
        sectors=_build_sectors(universe_world),
        news_feeds=universe_world.NEWS_FEEDS, news_locale=universe_world.NEWS_LOCALE,
        benchmark="^GSPC",
    ),
}
