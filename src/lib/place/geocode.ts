import { isCoastalSouthernCalifornia } from "../demo-data";
import { FALLBACK_LOCATION_NAME } from "../geo-fallback";
import type { LatLng } from "../types";
import { isGoogleMapsConfigured } from "./config";
import { reverseGeocodeGoogle } from "./google";
import type { PlaceName } from "./types";

interface BigDataCloudResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: {
    informative?: Array<{ name?: string; description?: string }>;
  };
}

function demoPlace(origin: LatLng): PlaceName {
  if (isCoastalSouthernCalifornia(origin)) {
    return {
      label: FALLBACK_LOCATION_NAME,
      locality: "Long Beach",
      region: "California",
      country: "United States",
      source: "demo",
    };
  }
  return {
    label: `${origin.lat.toFixed(3)}°, ${origin.lng.toFixed(3)}°`,
    locality: null,
    region: null,
    country: null,
    source: "demo",
  };
}

/**
 * Reverse-geocode via BigDataCloud's free client endpoint (no key, CORS-friendly).
 * @see https://www.bigdatacloud.com/docs/api/free-api-and-cors
 */
export async function reverseGeocodeBigDataCloud(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<PlaceName> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(origin.lat));
  url.searchParams.set("longitude", String(origin.lng));
  url.searchParams.set("localityLanguage", "en");

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`BigDataCloud ${res.status}`);
  const data = (await res.json()) as BigDataCloudResponse;

  const locality = data.locality || data.city || null;
  const region = data.principalSubdivision || null;
  const neighborhood =
    data.localityInfo?.informative?.find((i) =>
      /neighbourhood|neighborhood|suburb|quarter|district/i.test(i.description ?? ""),
    )?.name ?? null;

  const labelParts = [neighborhood, locality].filter(Boolean);
  const label =
    labelParts.length > 0
      ? labelParts.join(", ")
      : [data.city, region].filter(Boolean).join(", ") || "Unknown place";

  return {
    label,
    locality,
    region,
    country: data.countryName ?? null,
    source: "bigdatacloud",
  };
}

/** Prefer Google Geocoding when the Maps key is present; otherwise BigDataCloud; last resort demo label. */
export async function reverseGeocode(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<PlaceName> {
  if (isGoogleMapsConfigured()) {
    try {
      const google = await reverseGeocodeGoogle(origin);
      if (google) return google;
    } catch {
      // fall through
    }
  }

  try {
    return await reverseGeocodeBigDataCloud(origin, signal);
  } catch {
    return demoPlace(origin);
  }
}
