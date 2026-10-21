import type { LatLng } from "./types";

/** Used when the browser can't or won't share a location, so the app is still explorable. */
export const FALLBACK_LOCATION: LatLng = { lat: 33.7701, lng: -118.1937 };
export const FALLBACK_LOCATION_NAME = "Long Beach, CA";
