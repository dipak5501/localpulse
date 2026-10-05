"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LatLng } from "@/lib/types";

/** Used when the browser can't or won't share a location, so the app is still explorable. */
export const FALLBACK_LOCATION: LatLng = { lat: 33.7701, lng: -118.1937 };
export const FALLBACK_LOCATION_NAME = "Long Beach, CA";

export type GeoState =
  | { status: "locating" }
  | { status: "ready"; position: LatLng; accuracyM: number }
  | { status: "fallback"; position: LatLng; reason: string };

const UNSUPPORTED: GeoState = {
  status: "fallback",
  position: FALLBACK_LOCATION,
  reason: "Your browser doesn't support geolocation.",
};

const noopSubscribe = () => () => {};

export function useGeolocation(): GeoState {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "geolocation" in navigator,
    () => true,
  );
  const [state, setState] = useState<GeoState>({ status: "locating" });

  useEffect(() => {
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
  }, [supported]);

  return supported ? state : UNSUPPORTED;
}
