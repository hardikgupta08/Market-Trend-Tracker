const nf = (locale: string, digits: number) =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const IN2 = nf("en-IN", 2);
const US2 = nf("en-US", 2);
const IN0 = nf("en-IN", 0);

export function price(v: number | null | undefined, currency?: string | null) {
  if (v == null) return "—";
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(4);
  return (currency === "INR" ? IN2 : US2).format(v);
}

export function pct(v: number | null | undefined, digits = 2) {
  if (v == null || Number.isNaN(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}%` : v < 0 ? `−${s}%` : `${s}%`;
}

export function signed(v: number | null | undefined, currency?: string | null) {
  if (v == null) return "—";
  const s = price(Math.abs(v), currency);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function marketCap(v: number | null | undefined, currency?: string | null) {
  if (v == null || v === 0) return "—";
  if (currency === "INR") {
    const cr = v / 1e7;
    if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)}L Cr`;
    return `₹${IN0.format(cr)} Cr`;
  }
  const sym = !currency || currency === "USD" ? "$" : "";
  const tail = sym ? "" : ` ${currency}`;
  if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T${tail}`;
  if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B${tail}`;
  if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(0)}M${tail}`;
  return `${sym}${US2.format(v)}${tail}`;
}

export function volume(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

export function ratio(v: number | null | undefined, digits = 1) {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);
}

export type Dir = "up" | "down" | "flat";

export function dir(v: number | null | undefined): Dir {
  if (v == null || Math.abs(v) < 0.005) return "flat";
  return v > 0 ? "up" : "down";
}

export function arrow(v: number | null | undefined) {
  const d = dir(v);
  return d === "up" ? "▲" : d === "down" ? "▼" : "■";
}

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function clock(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function countdown(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ticker(symbol: string) {
  return symbol.replace(/\.NS$|\.BO$/, "").replace(/^\^/, "");
}

export function rating(r: string | null | undefined) {
  if (!r) return null;
  const [score, label] = r.split(" - ");
  return { score: parseFloat(score), label: label ?? r };
}

const STATE_LABEL: Record<string, string> = {
  REGULAR: "Market open",
  PRE: "Pre-market",
  PREPRE: "Closed",
  POST: "After hours",
  POSTPOST: "Closed",
  CLOSED: "Closed",
};

export function marketState(s: string | null | undefined) {
  return s ? STATE_LABEL[s] ?? s : "—";
}
