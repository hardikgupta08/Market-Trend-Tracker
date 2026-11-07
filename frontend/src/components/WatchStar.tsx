import { toggleWatch, useWatchlist } from "../watchlist";
import { ticker } from "../format";

/** Add/remove toggle. Sits inside clickable rows, so it keeps its events to itself. */
export function WatchStar({ symbol, labelled }: { symbol: string; labelled?: boolean }) {
  const on = useWatchlist().includes(symbol);
  const action = `${on ? "Remove" : "Add"} ${ticker(symbol)} ${on ? "from" : "to"} watchlist`;
  return (
    <button
      type="button"
      className={`star ${on ? "on" : ""} ${labelled ? "labelled" : ""}`}
      aria-pressed={on}
      aria-label={action}
      title={action}
      onClick={(e) => {
        e.stopPropagation();
        toggleWatch(symbol);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span>
      {labelled && <span>{on ? "Watching" : "Watch"}</span>}
    </button>
  );
}
