import { useSyncExternalStore } from "react";

/** The watchlist lives in this browser's localStorage; there are no user accounts to tie it to. */
const KEY = "mt.watchlist";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

let symbols = read();
const listeners = new Set<() => void>();

function publish(next: string[]) {
  symbols = next;
  listeners.forEach((l) => l());
}

// Keep other open tabs in sync.
window.addEventListener("storage", (e) => {
  if (e.key === KEY) publish(read());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatchlist(): string[] {
  return useSyncExternalStore(subscribe, () => symbols);
}

export function toggleWatch(symbol: string) {
  const next = symbols.includes(symbol) ? symbols.filter((s) => s !== symbol) : [...symbols, symbol];
  publish(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
