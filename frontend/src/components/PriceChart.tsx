import { useEffect, useMemo, useRef, useState } from "react";
import type { ChartPoint } from "../types";
import { dir, pct, price, volume } from "../format";

interface Props {
  points: ChartPoint[];
  currency?: string | null;
  intraday?: boolean;
  height?: number;
}

const M = { top: 12, right: 64, bottom: 24, left: 8 };

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

/** Close-price line with crosshair + tooltip. One series, one y-axis. */
export function PriceChart({ points, currency, intraday, height = 260 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const closes = points.map((p) => p.c);
    let lo = Math.min(...closes);
    let hi = Math.max(...closes);
    const padY = (hi - lo) * 0.08 || hi * 0.01;
    lo -= padY;
    hi += padY;
    const iw = width - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const x = (i: number) => M.left + (i / (points.length - 1)) * iw;
    const y = (v: number) => M.top + (1 - (v - lo) / (hi - lo)) * ih;
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join("");
    const area = `${line}L${x(points.length - 1)},${M.top + ih}L${x(0)},${M.top + ih}Z`;
    const yTicks = niceTicks(lo, hi).filter((v) => v >= lo && v <= hi);
    const n = Math.min(5, points.length);
    const xTicks = Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (points.length - 1)));
    return { x, y, line, area, yTicks, xTicks, ih, iw };
  }, [points, width, height]);

  if (!geo) return <div className="chart-empty">Not enough data for this range.</div>;

  const first = points[0].c;
  const d = dir(points[points.length - 1].c - first);
  const fmtDate = (t: string) => {
    const dt = new Date(t);
    return intraday
      ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : dt.toLocaleDateString([], { day: "numeric", month: "short", year: points.length > 260 ? "2-digit" : undefined });
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    const i = Math.round((px / geo.iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const hp = hover != null ? points[hover] : null;
  const hx = hover != null ? geo.x(hover) : 0;

  return (
    <div className={`price-chart ${d}`} ref={wrap}>
      <svg
        width={width}
        height={height}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Price chart, ${points.length} points, ${pct(((points[points.length - 1].c - first) / first) * 100)} over range`}
      >
        <defs>
          <linearGradient id="pc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="pc-fill-top" />
            <stop offset="100%" className="pc-fill-bottom" />
          </linearGradient>
        </defs>
        {geo.yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} />
            <text className="axis" x={width - M.right + 6} y={geo.y(v)} dy="0.32em">
              {price(v, currency)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((i, k) => (
          <text
            key={i}
            className="axis"
            x={geo.x(i)}
            y={height - 6}
            textAnchor={k === 0 ? "start" : k === geo.xTicks.length - 1 ? "end" : "middle"}
          >
            {fmtDate(points[i].t)}
          </text>
        ))}
        <line className="baseline" x1={M.left} x2={width - M.right} y1={geo.y(first)} y2={geo.y(first)} />
        <path d={geo.area} fill="url(#pc-fill)" />
        <path className="pc-line" d={geo.line} fill="none" strokeWidth="2" strokeLinejoin="round" />
        {hp && (
          <g pointerEvents="none">
            <line className="crosshair" x1={hx} x2={hx} y1={M.top} y2={M.top + geo.ih} />
            <circle className="pc-dot" cx={hx} cy={geo.y(hp.c)} r="4.5" strokeWidth="2" />
          </g>
        )}
        <rect x={M.left} y={M.top} width={geo.iw} height={geo.ih} fill="transparent" />
      </svg>
      {hp && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(hx, 70), width - 140), top: 4 }}
          role="status"
        >
          <div className="tip-date">{new Date(hp.t).toLocaleString([], intraday ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" })}</div>
          <div className="tip-row"><span>Close</span><b>{price(hp.c, currency)}</b></div>
          {hp.h != null && <div className="tip-row"><span>High / Low</span><b>{price(hp.h, currency)} / {price(hp.l, currency)}</b></div>}
          <div className="tip-row"><span>vs start</span><b className={dir(hp.c - first)}>{pct(((hp.c - first) / first) * 100)}</b></div>
          {!!hp.v && <div className="tip-row"><span>Volume</span><b>{volume(hp.v)}</b></div>}
        </div>
      )}
    </div>
  );
}
