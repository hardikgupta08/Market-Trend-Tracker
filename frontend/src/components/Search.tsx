import { useEffect, useRef, useState } from "react";
import { api, enc } from "../api";
import type { SearchHit } from "../types";
import { price, ticker } from "../format";
import { Change } from "./Change";

export function Search({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      api<SearchHit[]>(`/search?q=${enc(term)}&limit=12`)
        .then((h) => {
          setHits(h);
          setActive(0);
        })
        .catch(() => setHits([]));
    }, 150);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pick = (h: SearchHit) => {
    onPick(h);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="search" ref={box}>
      <input
        ref={input}
        value={q}
        placeholder="Search company or ticker  ( / )"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(hits.length - 1, a + 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
          else if (e.key === "Enter" && hits[active]) pick(hits[active]);
          else if (e.key === "Escape") setOpen(false);
        }}
        aria-label="Search companies"
        aria-expanded={open && hits.length > 0}
        role="combobox"
      />
      {open && hits.length > 0 && (
        <ul className="search-results" role="listbox">
          {hits.map((h, i) => (
            <li key={h.symbol} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                <span className="sym">{ticker(h.symbol)}</span>
                <span className="cname">{h.name}</span>
                <span className="pill">{h.region === "india" ? "IN" : "GL"}</span>
                <span className="num">{price(h.price, h.currency)}</span>
                <Change pctValue={h.change_pct} showArrow={false} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
