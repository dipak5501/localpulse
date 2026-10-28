"use client";

import { useEffect, useState } from "react";
import { snapToGrid } from "@/lib/geo";
import { fetchAccessLayer, type AccessLayer } from "@/lib/place";
import type { LatLng } from "@/lib/types";

export type AccessState =
  | { status: "idle" }
  | { status: "loading"; layer: AccessLayer | null }
  | { status: "ready"; layer: AccessLayer };

/**
 * Loads neighborhood access POIs when origin cell or radius changes.
 * Prefer Google Places when configured; Overpass otherwise; labeled demo last.
 */
export function useAccessLayer(origin: LatLng | null, radiusKm: number): AccessState {
  const cell = origin ? snapToGrid(origin, 3) : null;
  const cellKey = cell ? `${cell.lat},${cell.lng}` : null;
  const requestKey = cellKey ? `${cellKey}|${radiusKm}` : null;
  const [layer, setLayer] = useState<AccessLayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!requestKey || !origin) return;

    const controller = new AbortController();
    let cancelled = false;

    const kickoff = window.setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);

    void fetchAccessLayer(origin, radiusKm, controller.signal)
      .then((next) => {
        if (cancelled) return;
        setLayer(next);
        setLoadedKey(requestKey);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (!origin || !requestKey) return { status: "idle" };
  if (layer && loadedKey === requestKey && !loading) return { status: "ready", layer };
  return { status: "loading", layer };
}
