import { arrow, dir, pct, signed } from "../format";

/** Signed change with an arrow glyph so direction never relies on colour alone. */
export function Change({
  pctValue,
  abs,
  currency,
  showArrow = true,
}: {
  pctValue: number | null | undefined;
  abs?: number | null;
  currency?: string | null;
  showArrow?: boolean;
}) {
  const d = dir(pctValue);
  return (
    <span className={`chg ${d}`}>
      {showArrow && <span className="arrow" aria-hidden>{arrow(pctValue)}</span>}
      {abs !== undefined && <span className="abs">{signed(abs, currency)}</span>}
      <span>{pct(pctValue)}</span>
    </span>
  );
}
