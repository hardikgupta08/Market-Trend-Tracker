export type RegionId = "india" | "world";

export interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  prev_close?: number | null;
  volume?: number | null;
  avg_volume?: number | null;
  market_cap?: number | null;
  pe?: number | null;
  forward_pe?: number | null;
  pb?: number | null;
  dividend_yield?: number | null;
  eps?: number | null;
  high_52w?: number | null;
  low_52w?: number | null;
  change_52w_pct?: number | null;
  from_high_pct?: number | null;
  sma_50?: number | null;
  sma_200?: number | null;
  analyst_rating?: string | null;
  currency?: string | null;
  market_state?: string | null;
  exchange?: string | null;
  market_time?: string | null;
  quote_type?: string | null;
  sector?: string;
  rank?: number;
  region?: RegionId | null;
}

export interface Instrument extends Quote {
  ret_1w?: number | null;
  ret_1m?: number | null;
  ret_3m?: number | null;
  ret_ytd?: number | null;
  ret_1y?: number | null;
  spark?: number[];
  /** "refresh_log" when Yahoo has no history and the spark comes from recorded refreshes. */
  history_source?: string;
}

export interface Brief {
  symbol: string;
  name: string;
  change_pct: number | null;
  price: number | null;
}

export interface SectorSummary {
  id: string;
  name: string;
  index_symbol: string | null;
  index: Instrument | null;
  count: number;
  advances: number;
  declines: number;
  unchanged: number;
  avg_change_pct: number | null;
  weighted_change_pct: number | null;
  total_market_cap: number | null;
  top_gainer: Brief | null;
  top_loser: Brief | null;
  leaders: Brief[];
}

export interface Mover {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: number | null;
  sector: string;
}

export interface Overview {
  region: RegionId;
  name: string;
  currency: string;
  updated_at: string;
  market_state: string | null;
  indices: Instrument[];
  macro: Instrument[];
  sectors: SectorSummary[];
  movers: { gainers: Mover[]; losers: Mover[]; active: Mover[]; near_high: Mover[] };
  breadth: { advances: number; declines: number; total: number };
}

export interface SectorDetail {
  updated_at: string;
  currency: string;
  sector: SectorSummary;
  companies: Quote[];
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string | null;
  summary: string;
}

export interface NewsResponse {
  scope: "market" | "sector" | "symbol";
  updated_at?: string;
  query?: string;
  items: NewsItem[];
}

export interface ChartPoint {
  t: string;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number;
  v: number | null;
}

export interface ChartResponse {
  symbol: string;
  range: string;
  interval: string;
  points: ChartPoint[];
}

export interface Status {
  server_time: string;
  refresh_interval_minutes: number;
  news_interval_minutes: number;
  slow_refresh_minutes: number;
  picks_schedule_utc: Record<RegionId, string>;
  running: string[];
  next_run: Record<string, string | null>;
  regions: Record<
    RegionId,
    {
      updated_at: string | null;
      news_updated_at: string | null;
      market_state: string | null;
      in_session: boolean;
      picks_generated_at: string | null;
    }
  >;
}

export type Stance = "Bullish" | "Positive" | "Neutral" | "Cautious" | "Bearish";

export interface Returns {
  day: number | null;
  ret_1w: number | null;
  ret_1m: number | null;
  ret_3m: number | null;
  ret_ytd: number | null;
  ret_1y: number | null;
}

export interface BriefStock {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  change_52w_pct: number | null;
}

export interface SectorBrief {
  id: string;
  name: string;
  index_symbol: string | null;
  count: number;
  stance: Stance;
  score: number;
  headline: string;
  performance: Returns;
  performance_source: string;
  relative: { ret_1m: number | null; ret_3m: number | null; ret_1y: number | null };
  breadth: {
    advances: number;
    declines: number;
    above_50dma_pct: number | null;
    above_200dma_pct: number | null;
    near_high_pct: number | null;
    median_from_high_pct: number | null;
  };
  valuation: {
    median_pe: number | null;
    median_forward_pe: number | null;
    eps_decline_pct: number | null;
    median_pb: number | null;
    median_dividend_yield: number | null;
    market_median_pe: number | null;
  };
  sentiment: { avg_rating: number | null; buy_share_pct: number | null; rated: number };
  signals: { tone: "pos" | "neg" | "neu"; text: string }[];
  watch: string[];
  leaders_1y: BriefStock[];
  laggards_1y: BriefStock[];
}

export interface BriefsResponse {
  region: RegionId;
  updated_at: string;
  benchmark: { symbol: string; name: string | null; change_pct: number | null } & Partial<Returns>;
  briefs: SectorBrief[];
}

export type PickStatus = "active" | "target_reached" | "stop_hit";

export interface Pick {
  symbol: string;
  name: string;
  sector: string;
  currency: string | null;
  entry: number;
  target: number;
  stop_loss: number;
  target_high: number | null;
  target_low: number | null;
  upside_pct: number;
  risk_pct: number;
  risk_reward: number;
  rating: number;
  rating_key: string | null;
  analysts: number;
  above_50dma: boolean | null;
  above_200dma: boolean | null;
  market_cap: number | null;
  pe: number | null;
  reasons: string[];
  price: number | null;
  change_pct: number | null;
  since_entry_pct: number | null;
  status: PickStatus;
}

export interface PicksResponse {
  region: RegionId;
  generated_at: string;
  prices_as_of: string;
  screened: number;
  passed: number;
  methodology: Record<"source" | "target" | "stop_loss" | "screen" | "horizon", string>;
  picks: Pick[];
}

export interface SearchHit {
  symbol: string;
  name: string;
  region: RegionId;
  sector: string;
  price: number | null;
  change_pct: number | null;
  currency: string | null;
}

/** What the detail drawer is showing. */
export interface Selection {
  symbol: string;
  name?: string;
  kind: "stock" | "index";
  currency?: string | null;
}
