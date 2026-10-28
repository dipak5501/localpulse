import type { LatLng } from "../types";
import { isGoogleMapsConfigured } from "./config";
import { reverseGeocode } from "./geocode";
import { loadGoogleMaps } from "./google";
import { fetchHazardsBrief } from "./hazards";
import type { PlaceBrief } from "./types";
import { fetchWeather } from "./weather";
import { fetchWikipediaNearby } from "./wikipedia";

export interface FetchPlaceBriefOptions {
  signal?: AbortSignal;
}

/**
 * Assemble a living place brief from independent public APIs.
 * Partial failures are collected in `errors` so the UI still renders what worked.
 */
export async function fetchPlaceBrief(
  origin: LatLng,
  options: FetchPlaceBriefOptions = {},
): Promise<PlaceBrief> {
  const { signal } = options;
  const errors: string[] = [];
  const googleEnabled = isGoogleMapsConfigured();

  if (googleEnabled) {
    const g = await loadGoogleMaps();
    if (!g) errors.push("Google Maps key is set but the script failed to load.");
  }

  const [placeResult, weatherResult, wikiResult, hazardsResult] = await Promise.allSettled([
    reverseGeocode(origin, signal),
    fetchWeather(origin, signal),
    fetchWikipediaNearby(origin, signal),
    fetchHazardsBrief(origin, signal),
  ]);

  const place =
    placeResult.status === "fulfilled"
      ? placeResult.value
      : {
          label: `${origin.lat.toFixed(3)}°, ${origin.lng.toFixed(3)}°`,
          locality: null,
          region: null,
          country: null,
          source: "demo" as const,
        };
  if (placeResult.status === "rejected") {
    errors.push("Place name unavailable");
  }

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  if (weatherResult.status === "rejected") {
    errors.push("Weather unavailable (Open-Meteo)");
  }

  const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : null;
  if (wikiResult.status === "rejected") {
    errors.push("Wikipedia nearby unavailable");
  }

  const hazards = hazardsResult.status === "fulfilled" ? hazardsResult.value : null;
  if (hazardsResult.status === "rejected") {
    errors.push("Coastal & seismic brief unavailable");
  } else if (hazards) {
    errors.push(...hazards.errors);
  }

  return {
    origin,
    place,
    weather,
    wiki,
    hazards,
    googleEnabled,
    fetchedAt: Date.now(),
    errors,
  };
}
