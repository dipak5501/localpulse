import { isCoastalSouthernCalifornia } from "../demo-data";
import { haversineKm, offsetPoint } from "../geo";
import type { LatLng } from "../types";
import type { AccessKind, AccessPoint } from "./types";

/**
 * Labeled sample access POIs so the Access map mode stays explorable when
 * Overpass is down and no Google key is configured. Never treated as live OSM.
 */
const LONG_BEACH_SEED: Array<{ name: string; kind: AccessKind; bearing: number; km: number }> = [
  { name: "St. Mary Medical Center", kind: "clinic", bearing: 20, km: 0.9 },
  { name: "Long Beach Memorial Medical Center", kind: "clinic", bearing: 350, km: 2.4 },
  { name: "CVS Pharmacy — Broadway", kind: "pharmacy", bearing: 80, km: 0.4 },
  { name: "Walgreens — Pine Ave", kind: "pharmacy", bearing: 200, km: 0.6 },
  { name: "Grocery Outlet — Downtown", kind: "grocery", bearing: 140, km: 0.8 },
  { name: "Whole Foods — Belmont Shore", kind: "grocery", bearing: 110, km: 3.2 },
  { name: "1st Street Metro Blue Line", kind: "transit", bearing: 260, km: 0.5 },
  { name: "Transit Mall · Long Beach Transit", kind: "transit", bearing: 230, km: 0.3 },
  { name: "Rainbow Harbor / Shoreline Park", kind: "park", bearing: 200, km: 0.7 },
  { name: "Promenade Park", kind: "park", bearing: 180, km: 0.4 },
];

function genericSeed(origin: LatLng): AccessPoint[] {
  const kinds: AccessKind[] = ["clinic", "pharmacy", "grocery", "transit", "park"];
  return kinds.flatMap((kind, i) => {
    const point = offsetPoint(origin, 0.4 + i * 0.35, i * 72);
    return [
      {
        id: `demo-${kind}-${i}`,
        name: `Sample ${kind} (${origin.lat.toFixed(2)}, ${origin.lng.toFixed(2)})`,
        kind,
        lat: point.lat,
        lng: point.lng,
        distanceKm: haversineKm(origin, point),
      },
    ];
  });
}

/** Deterministic demo access layer — always labeled `demo` by callers. */
export function generateDemoAccessPoints(origin: LatLng, radiusKm: number): AccessPoint[] {
  const raw = isCoastalSouthernCalifornia(origin)
    ? LONG_BEACH_SEED.map((item, i) => {
        const point = offsetPoint(origin, item.km, item.bearing);
        return {
          id: `demo-lb-${i}`,
          name: item.name,
          kind: item.kind,
          lat: point.lat,
          lng: point.lng,
          distanceKm: haversineKm(origin, point),
        } satisfies AccessPoint;
      })
    : genericSeed(origin);

  return raw.filter((p) => p.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
}
