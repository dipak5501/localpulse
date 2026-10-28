import { haversineKm } from "../geo";
import type { LatLng } from "../types";
import { getGoogleMapsApiKey, isGoogleMapsConfigured } from "./config";
import type { AccessKind, AccessPoint, PlaceName } from "./types";

type GoogleMapsNamespace = {
  maps: {
    Geocoder: new () => {
      geocode: (
        req: { location: { lat: number; lng: number } },
        cb: (
          results: Array<{
            formatted_address?: string;
            address_components?: Array<{ long_name: string; types: string[] }>;
          }> | null,
          status: string,
        ) => void,
      ) => void;
    };
    LatLng: new (lat: number, lng: number) => unknown;
    places: {
      PlacesService: new (attrContainer: HTMLElement) => {
        nearbySearch: (
          req: {
            location: unknown;
            radius: number;
            type?: string;
            keyword?: string;
          },
          cb: (
            results: Array<{
              place_id?: string;
              name?: string;
              geometry?: { location?: { lat: () => number; lng: () => number } };
              types?: string[];
            }> | null,
            status: string,
          ) => void,
        ) => void;
      };
      PlacesServiceStatus: { OK: string; ZERO_RESULTS: string };
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __harborbriefGooglePromise?: Promise<GoogleMapsNamespace | null>;
  }
}

const GOOGLE_ACCESS_QUERIES: Array<{ kind: AccessKind; type: string }> = [
  { kind: "clinic", type: "hospital" },
  { kind: "pharmacy", type: "pharmacy" },
  { kind: "grocery", type: "supermarket" },
  { kind: "transit", type: "transit_station" },
  { kind: "park", type: "park" },
];

/** Dynamically load the Maps JavaScript API (Places + Geocoding). */
export function loadGoogleMaps(): Promise<GoogleMapsNamespace | null> {
  if (!isGoogleMapsConfigured() || typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (window.__harborbriefGooglePromise) return window.__harborbriefGooglePromise;

  const key = getGoogleMapsApiKey()!;
  window.__harborbriefGooglePromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-harborbrief-google]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google ?? null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const script = document.createElement("script");
    script.dataset.harborbriefGoogle = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    script.onload = () => resolve(window.google ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return window.__harborbriefGooglePromise;
}

function pickComponent(
  components: Array<{ long_name: string; types: string[] }> | undefined,
  type: string,
): string | null {
  return components?.find((c) => c.types.includes(type))?.long_name ?? null;
}

export async function reverseGeocodeGoogle(origin: LatLng): Promise<PlaceName | null> {
  const g = await loadGoogleMaps();
  if (!g?.maps?.Geocoder) return null;

  return new Promise((resolve) => {
    const geocoder = new g.maps.Geocoder();
    geocoder.geocode({ location: { lat: origin.lat, lng: origin.lng } }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }
      const best = results[0];
      const comps = best.address_components;
      const neighborhood =
        pickComponent(comps, "neighborhood") ??
        pickComponent(comps, "sublocality") ??
        pickComponent(comps, "sublocality_level_1");
      const locality =
        pickComponent(comps, "locality") ?? pickComponent(comps, "postal_town");
      const region = pickComponent(comps, "administrative_area_level_1");
      const country = pickComponent(comps, "country");
      const label =
        [neighborhood, locality].filter(Boolean).join(", ") ||
        best.formatted_address?.split(",").slice(0, 2).join(",").trim() ||
        "Unknown place";

      resolve({
        label,
        locality,
        region,
        country,
        source: "google",
      });
    });
  });
}

function placesNearby(
  service: InstanceType<GoogleMapsNamespace["maps"]["places"]["PlacesService"]>,
  location: unknown,
  radiusM: number,
  type: string,
  okStatus: string,
  zeroStatus: string,
): Promise<
  Array<{
    place_id?: string;
    name?: string;
    geometry?: { location?: { lat: () => number; lng: () => number } };
  }>
> {
  return new Promise((resolve) => {
    service.nearbySearch({ location, radius: radiusM, type }, (results, status) => {
      if (status === okStatus || status === zeroStatus) resolve(results ?? []);
      else resolve([]);
    });
  });
}

/**
 * Neighborhood access POIs via Places Nearby Search (requires Maps JS + Places library).
 * Uses a detached attribution node — no visible Google Map required.
 */
export async function fetchAccessGoogle(
  origin: LatLng,
  radiusKm: number,
): Promise<AccessPoint[]> {
  const g = await loadGoogleMaps();
  if (!g?.maps?.places) return [];

  const attribution = document.createElement("div");
  attribution.style.display = "none";
  document.body.appendChild(attribution);
  try {
    const service = new g.maps.places.PlacesService(attribution);
    const location = new g.maps.LatLng(origin.lat, origin.lng);
    const radiusM = Math.min(Math.max(radiusKm, 0.5), 15) * 1000;
    const { OK, ZERO_RESULTS } = g.maps.places.PlacesServiceStatus;

    const batches = await Promise.all(
      GOOGLE_ACCESS_QUERIES.map(async ({ kind, type }) => {
        const results = await placesNearby(service, location, radiusM, type, OK, ZERO_RESULTS);
        return results.slice(0, 8).flatMap((place, index) => {
          const loc = place.geometry?.location;
          if (!loc || !place.name) return [];
          const lat = loc.lat();
          const lng = loc.lng();
          return [
            {
              id: `g-${kind}-${place.place_id ?? index}`,
              name: place.name,
              kind,
              lat,
              lng,
              distanceKm: haversineKm(origin, { lat, lng }),
            } satisfies AccessPoint,
          ];
        });
      }),
    );

    return batches.flat().sort((a, b) => a.distanceKm - b.distanceKm);
  } finally {
    attribution.remove();
  }
}
