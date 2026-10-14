import { dir } from "../format";

interface Props {
  values?: number[];
  width?: number;
  height?: number;
  label?: string;
}

/** Single-series trend line; colour follows the period's direction. */
export function Sparkline({ values, width = 96, height = 28, label }: Props) {
  if (!values || values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const d = dir(values[values.length - 1] - values[0]);
  return (
    <svg
      className={`spark ${d}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `Trend ${d}`}
    >
      <polyline points={pts} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
