"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FALLBACK_LOCATION, FALLBACK_LOCATION_NAME } from "@/lib/geo-fallback";
import { parseLocationQuery } from "@/lib/location-query";
import type { LatLng } from "@/lib/types";

export { FALLBACK_LOCATION, FALLBACK_LOCATION_NAME };

export type GeoState =
  | { status: "locating" }
  | { status: "ready"; position: LatLng; accuracyM: number }
  | { status: "fallback"; position: LatLng; reason: string }
  | { status: "shared"; position: LatLng };

const UNSUPPORTED: GeoState = {
  status: "fallback",
  position: FALLBACK_LOCATION,
  reason: "Your browser doesn't support geolocation.",
};

const noopSubscribe = () => () => {};

/** Cache so useSyncExternalStore getSnapshot stays referentially stable. */
let sharedCache: { search: string; point: LatLng | null } | null = null;

function readSharedLocation(): LatLng | null {
  if (typeof window === "undefined") return null;
  const search = window.location.search;
  if (sharedCache && sharedCache.search === search) return sharedCache.point;
  const point = parseLocationQuery(search);
  sharedCache = { search, point };
  return point;
}

export function useGeolocation(): GeoState {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "geolocation" in navigator,
    () => true,
  );
  // Cached getSnapshot keeps referential stability (avoids infinite re-renders).
  // getServerSnapshot returns null so SSR/hydration stay matched; client then
  // reads ?lat=&lng= after hydrate without an effect setState.
  const shared = useSyncExternalStore(
    noopSubscribe,
    readSharedLocation,
    () => null,
  );
  const [state, setState] = useState<GeoState>({ status: "locating" });

  useEffect(() => {
    if (shared) return;
    if (!supported) return;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setState({
          status: "ready",
          position: { lat: coords.latitude, lng: coords.longitude },
          accuracyM: coords.accuracy,
        }),
      (error) =>
        setState((prev) =>
          prev.status === "ready"
            ? prev
            : {
                status: "fallback",
                position: FALLBACK_LOCATION,
                reason:
                  error.code === error.PERMISSION_DENIED
                    ? "Location access was denied."
                    : "We couldn't determine your location.",
              },
        ),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [supported, shared]);

  if (shared) return { status: "shared", position: shared };
  if (!supported) return UNSUPPORTED;
  return state;
}
