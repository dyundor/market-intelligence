"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrendMetric } from "../../lib/products/trend-metrics.ts";

const DAYS_TO_MONTHS: Record<number, number> = {
  30: 1,
  90: 3,
  180: 6,
};

export type DayRange = 30 | 90 | 180;

export type TrendDataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "success"; data: TrendMetric };

export function useTrendData(productId: string, dayRange: DayRange) {
  const [state, setState] = useState<TrendDataState>({ status: "idle" });
  const fetchIdRef = useRef(0);

  const retry = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const currentFetchId = ++fetchIdRef.current;
    const months = DAYS_TO_MONTHS[dayRange];

    setState({ status: "loading" });

    fetch(
      `/api/hot-products/trend?product_id=${encodeURIComponent(productId)}&months=${months}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (currentFetchId !== fetchIdRef.current) return;
        if (!r.ok) {
          if (r.status === 404) {
            setState({ status: "empty" });
          } else {
            const body = await r.json().catch(() => ({}));
            setState({ status: "error", message: (body as { error?: string }).error || `HTTP ${r.status}` });
          }
          return;
        }
        const data: TrendMetric = await r.json();
        if (data.points.length === 0) {
          setState({ status: "empty" });
        } else {
          setState({ status: "success", data });
        }
      })
      .catch((err) => {
        if (currentFetchId !== fetchIdRef.current) return;
        if (err.name === "AbortError") return;
        setState({ status: "error", message: err.message || String(err) });
      });

    return () => controller.abort();
  }, [productId, dayRange]);

  return { state, retry };
}
