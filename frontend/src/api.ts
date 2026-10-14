import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, init);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export const enc = encodeURIComponent;

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetch `path` whenever it (or `version`) changes. Keeps the previous data while
 * re-fetching the same path so panels don't flash. Retries 503 ("still loading") every 5s.
 */
export function useApi<T>(path: string | null, version: unknown = 0): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: !!path });
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const samePath = lastPath.current === path;
    lastPath.current = path;
    setState((s) => ({ data: samePath ? s.data : null, error: null, loading: true }));

    const load = () =>
      api<T>(path)
        .then((data) => {
          if (!cancelled) setState({ data, error: null, loading: false });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          const status = e instanceof ApiError ? e.status : 0;
          const msg = e instanceof Error ? e.message : String(e);
          setState((s) => ({ ...s, error: msg, loading: status === 503 }));
          if (status === 503) timer = window.setTimeout(load, 5000);
        });
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [path, version]);

  return state;
}
