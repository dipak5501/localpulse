import type { LatLng } from "../types";

/** Where a place name / address came from. */
export type PlaceSource = "google" | "bigdatacloud" | "demo";

/** Where access POIs came from. */
export type AccessSource = "google" | "overpass" | "demo";

export type AccessKind = "clinic" | "pharmacy" | "grocery" | "transit" | "park";

export interface PlaceName {
  /** Short label for the UI, e.g. "Downtown Long Beach". */
  label: string;
  locality: string | null;
  region: string | null;
  country: string | null;
  source: PlaceSource;
}

export interface WeatherSnapshot {
  temperatureF: number;
  humidityPct: number;
  windMph: number;
  weatherCode: number;
  /** Human-readable WMO summary. */
  summary: string;
  fetchedAt: number;
}

export interface WikiPlace {
  title: string;
  extract: string;
  url: string;
  distanceM: number | null;
}

export interface AccessPoint {
  id: string;
  name: string;
  kind: AccessKind;
  lat: number;
  lng: number;
  distanceKm: number;
}

export interface AccessLayer {
  points: AccessPoint[];
  source: AccessSource;
  /** True when points are seeded / sample data, not a live network response. */
  demo: boolean;
  error: string | null;
  fetchedAt: number;
}

/** Coastal & seismic brief — USGS / NWS / NOAA (not a Google crisis API). */
export type HazardSeverity = "info" | "advisory" | "watch" | "warning" | "extreme";
export type HazardKind = "earthquake" | "tsunami" | "tide" | "coastal_flood";

export interface HazardItem {
  id: string;
  kind: HazardKind;
  severity: HazardSeverity;
  title: string;
  summary: string;
  /** Event time (epoch ms). */
  at: number;
  distanceKm: number | null;
  /** Authority label shown in the UI, e.g. "USGS", "NWS", "NOAA CO-OPS". */
  source: string;
  sourceUrl: string;
  lat?: number;
  lng?: number;
}

export interface TideBrief {
  stationId: string;
  stationName: string;
  distanceKm: number;
  nextHigh: { at: number; heightFt: number } | null;
  nextLow: { at: number; heightFt: number } | null;
  /** Non-alarmist framing from predictions alone (not an official flood warning). */
  framing: string;
  sourceUrl: string;
}

export interface HazardsBrief {
  earthquakes: HazardItem[];
  tsunamis: HazardItem[];
  coastalFloods: HazardItem[];
  tide: TideBrief | null;
  fetchedAt: number;
  errors: string[];
}

export interface PlaceBrief {
  origin: LatLng;
  place: PlaceName;
  weather: WeatherSnapshot | null;
  wiki: WikiPlace | null;
  /** USGS / NWS / NOAA coastal & seismic signals for the map center. */
  hazards: HazardsBrief | null;
  /** Present when Google Maps JS loaded successfully. */
  googleEnabled: boolean;
  fetchedAt: number;
  /** Partial failures; brief still renders what it can. */
  errors: string[];
}

export const ACCESS_KIND_META: Record<
  AccessKind,
  { label: string; color: string; short: string }
> = {
  clinic: { label: "Clinics & care", color: "#0f766e", short: "Care" },
  pharmacy: { label: "Pharmacies", color: "#1d4ed8", short: "Rx" },
  grocery: { label: "Groceries", color: "#b45309", short: "Food" },
  transit: { label: "Transit", color: "#7c3aed", short: "Transit" },
  park: { label: "Parks", color: "#15803d", short: "Parks" },
};
