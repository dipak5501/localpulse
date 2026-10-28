"use client";

import { useEffect, useState } from "react";
import { snapToGrid } from "@/lib/geo";
import { fetchPlaceBrief, type PlaceBrief } from "@/lib/place";
import type { LatLng } from "@/lib/types";

export type PlaceBriefState =
  | { status: "idle" }
  | { status: "loading"; brief: PlaceBrief | null }
  | { status: "ready"; brief: PlaceBrief }
  | { status: "error"; message: string; brief: PlaceBrief | null };

/**
 * Fetches a place brief when the snapped grid cell changes (~100 m).
 * Keeps the previous brief visible while refreshing.
 */
export function usePlaceBrief(origin: LatLng | null): PlaceBriefState {
  const cell = origin ? snapToGrid(origin, 3) : null;
  const cellKey = cell ? `${cell.lat},${cell.lng}` : null;
  const [brief, setBrief] = useState<PlaceBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!cellKey || !origin) return;

    const controller = new AbortController();
    let cancelled = false;

    // Defer loading flag so we don't sync-setState in the effect body (lint).
    const kickoff = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    }, 0);

    void fetchPlaceBrief(origin, { signal: controller.signal })
      .then((next) => {
        if (cancelled) return;
        setBrief(next);
        setLoadedKey(cellKey);
        setLoading(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Place brief failed");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
      controller.abort();
    };
    // Intentionally key off snapped cell so GPS jitter doesn't spam APIs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKey]);

  if (!origin || !cellKey) return { status: "idle" };
  if (loading && loadedKey !== cellKey) return { status: "loading", brief };
  if (error && loadedKey !== cellKey && !brief) return { status: "error", message: error, brief: null };
  if (brief && loadedKey === cellKey) {
    if (loading) return { status: "loading", brief };
    if (error) return { status: "error", message: error, brief };
    return { status: "ready", brief };
  }
  if (brief) return { status: "loading", brief };
  return { status: "loading", brief: null };
}
