import type { LatLng } from "./types";

/**
 * Parses `?lat=&lng=` from a URL search string so recruiters can deep-link a
 * city (e.g. Long Beach) without waiting on geolocation.
 */
export function parseLocationQuery(search: string): LatLng | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  if (latRaw === null || lngRaw === null || latRaw.trim() === "" || lngRaw.trim() === "") return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function locationQueryString(point: LatLng): string {
  return `?lat=${point.lat.toFixed(5)}&lng=${point.lng.toFixed(5)}`;
}
