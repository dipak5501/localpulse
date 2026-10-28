import { haversineKm } from "../geo";
import type { LatLng } from "../types";
import { generateDemoAccessPoints } from "./access-demo";
import { isGoogleMapsConfigured } from "./config";
import { fetchAccessGoogle } from "./google";
import type { AccessKind, AccessLayer, AccessPoint } from "./types";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
] as const;

const UA = "Harborbrief/1.0 (https://github.com/dipak5501/localpulse; educational portfolio demo)";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function kindFromTags(tags: Record<string, string> | undefined): AccessKind | null {
  if (!tags) return null;
  if (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.amenity === "doctors") {
    return "clinic";
  }
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.shop === "supermarket" || tags.shop === "grocery" || tags.shop === "convenience") {
    return "grocery";
  }
  if (
    tags.highway === "bus_stop" ||
    tags.railway === "station" ||
    tags.railway === "tram_stop" ||
    tags.public_transport === "station" ||
    tags.amenity === "bus_station"
  ) {
    return "transit";
  }
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  return null;
}

function buildOverpassQuery(origin: LatLng, radiusM: number): string {
  const { lat, lng } = origin;
  return `
[out:json][timeout:18];
(
  node["amenity"="hospital"](around:${radiusM},${lat},${lng});
  node["amenity"="clinic"](around:${radiusM},${lat},${lng});
  node["amenity"="doctors"](around:${radiusM},${lat},${lng});
  node["amenity"="pharmacy"](around:${radiusM},${lat},${lng});
  node["shop"="supermarket"](around:${radiusM},${lat},${lng});
  node["shop"="grocery"](around:${radiusM},${lat},${lng});
  node["highway"="bus_stop"](around:${Math.min(radiusM, 1200)},${lat},${lng});
  node["railway"="station"](around:${radiusM},${lat},${lng});
  node["public_transport"="station"](around:${radiusM},${lat},${lng});
  node["leisure"="park"](around:${radiusM},${lat},${lng});
  way["leisure"="park"](around:${radiusM},${lat},${lng});
);
out center 60;
`.trim();
}

async function fetchOverpassOnce(
  endpoint: string,
  query: string,
  signal?: AbortSignal,
): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": UA,
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const data = (await res.json()) as OverpassResponse;
    return data.elements ?? [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchAccessOverpass(
  origin: LatLng,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<AccessPoint[]> {
  const radiusM = Math.round(Math.min(Math.max(radiusKm, 0.5), 8) * 1000);
  const query = buildOverpassQuery(origin, radiusM);
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const elements = await fetchOverpassOnce(endpoint, query, signal);
      const points: AccessPoint[] = [];
      for (const el of elements) {
        const kind = kindFromTags(el.tags);
        if (!kind) continue;
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (lat === undefined || lng === undefined) continue;
        const name = el.tags?.name || el.tags?.["name:en"] || `Unnamed ${kind}`;
        points.push({
          id: `osm-${el.type}-${el.id}`,
          name,
          kind,
          lat,
          lng,
          distanceKm: haversineKm(origin, { lat, lng }),
        });
      }
      return points.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass unavailable");
}

/**
 * Prefer Google Places when configured; else OSM Overpass; else labeled demo seed.
 */
export async function fetchAccessLayer(
  origin: LatLng,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<AccessLayer> {
  const fetchedAt = Date.now();

  if (isGoogleMapsConfigured()) {
    try {
      const points = await fetchAccessGoogle(origin, radiusKm);
      if (points.length > 0) {
        return { points, source: "google", demo: false, error: null, fetchedAt };
      }
    } catch {
      // fall through to Overpass
    }
  }

  try {
    const points = await fetchAccessOverpass(origin, radiusKm, signal);
    if (points.length > 0) {
      return { points, source: "overpass", demo: false, error: null, fetchedAt };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Overpass failed";
    return {
      points: generateDemoAccessPoints(origin, radiusKm),
      source: "demo",
      demo: true,
      error: `${message}. Showing labeled sample access points.`,
      fetchedAt,
    };
  }

  return {
    points: generateDemoAccessPoints(origin, radiusKm),
    source: "demo",
    demo: true,
    error: "No live access POIs nearby. Showing labeled sample points.",
    fetchedAt,
  };
}

export function summarizeAccess(points: readonly AccessPoint[]): Record<AccessKind, number> {
  const counts: Record<AccessKind, number> = {
    clinic: 0,
    pharmacy: 0,
    grocery: 0,
    transit: 0,
    park: 0,
  };
  for (const p of points) counts[p.kind] += 1;
  return counts;
}
