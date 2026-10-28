import { haversineKm } from "../geo";
import type { LatLng } from "../types";
import stations from "./data/noaa-tide-stations.json";
import type { HazardItem, HazardSeverity, HazardsBrief, TideBrief } from "./types";

const APP = "Harborbrief/1.0 (https://github.com/dipak5501/localpulse; educational portfolio demo)";

interface TideStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
}

const TIDE_STATIONS = stations as TideStation[];

/** Max distance (km) to consider a NOAA tide gauge "nearby". */
export const TIDE_STATION_MAX_KM = 80;

/** Regional earthquake search radius around the map center. */
export const EARTHQUAKE_RADIUS_KM = 500;

interface UsgsFeature {
  id?: string;
  geometry?: { coordinates?: number[] };
  properties?: {
    mag?: number | null;
    place?: string | null;
    time?: number | null;
    url?: string | null;
    tsunami?: number | null;
    title?: string | null;
  };
}

interface UsgsResponse {
  features?: UsgsFeature[];
}

interface NwsAlertFeature {
  id?: string;
  properties?: {
    id?: string;
    event?: string;
    headline?: string | null;
    description?: string | null;
    severity?: string | null;
    urgency?: string | null;
    effective?: string | null;
    onset?: string | null;
    ends?: string | null;
    sent?: string | null;
    web?: string | null;
    areaDesc?: string | null;
  };
}

interface NwsAlertsResponse {
  features?: NwsAlertFeature[];
}

interface TidePredictionRow {
  t: string;
  v: string;
  type?: string;
}

interface TidePredictionsResponse {
  predictions?: TidePredictionRow[];
  error?: { message?: string };
}

export function earthquakeSeverity(mag: number): HazardSeverity {
  if (mag >= 7) return "extreme";
  if (mag >= 6) return "warning";
  if (mag >= 5) return "watch";
  if (mag >= 4) return "advisory";
  return "info";
}

export function nwsSeverity(raw: string | null | undefined): HazardSeverity {
  const s = (raw ?? "").toLowerCase();
  if (s === "extreme") return "extreme";
  if (s === "severe") return "warning";
  if (s === "moderate") return "watch";
  if (s === "minor") return "advisory";
  return "info";
}

export function nearestTideStation(
  origin: LatLng,
  list: TideStation[] = TIDE_STATIONS,
  maxKm = TIDE_STATION_MAX_KM,
): { station: TideStation; distanceKm: number } | null {
  let best: { station: TideStation; distanceKm: number } | null = null;
  for (const station of list) {
    const distanceKm = haversineKm(origin, { lat: station.lat, lng: station.lng });
    if (distanceKm > maxKm) continue;
    if (!best || distanceKm < best.distanceKm) best = { station, distanceKm };
  }
  return best;
}

/** Parse NOAA CO-OPS `YYYY-MM-DD HH:MM` local station time as a best-effort Date. */
export function parseNoaaLocalTime(raw: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return Date.parse(raw);
  const [, y, mo, d, h, mi] = m;
  // Treat as local wall clock of the viewer — good enough for "next high" ordering in demos.
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)).getTime();
}

export function tideFraming(nextHighFt: number | null, distanceKm: number): string {
  if (nextHighFt === null) {
    return `Nearest NOAA gauge is ${distanceKm.toFixed(1)} km away. Tide predictions unavailable.`;
  }
  if (nextHighFt >= 7) {
    return `Next high ${nextHighFt.toFixed(1)} ft MLLW — elevated vs typical Southern California harbor tides. Check NWS coastal flood products; this is not an official flood warning.`;
  }
  if (nextHighFt >= 5.5) {
    return `Next high ${nextHighFt.toFixed(1)} ft MLLW — on the higher side. Predictions alone are not a flood alert.`;
  }
  return `Next high ${nextHighFt.toFixed(1)} ft MLLW at the nearest NOAA station. Normal tide cycle signal from predictions alone.`;
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

async function fetchEarthquakes(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<{ quakes: HazardItem[]; tsunamiFlags: HazardItem[] }> {
  const url = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("latitude", String(origin.lat));
  url.searchParams.set("longitude", String(origin.lng));
  url.searchParams.set("maxradiuskm", String(EARTHQUAKE_RADIUS_KM));
  url.searchParams.set("minmagnitude", "2.5");
  url.searchParams.set("orderby", "time");
  url.searchParams.set("limit", "12");

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = (await res.json()) as UsgsResponse;
  const quakes: HazardItem[] = [];
  const tsunamiFlags: HazardItem[] = [];

  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates;
    const lng = coords?.[0];
    const lat = coords?.[1];
    const mag = typeof props.mag === "number" ? props.mag : null;
    if (mag === null || lat === undefined || lng === undefined) continue;
    const at = typeof props.time === "number" ? props.time : Date.now();
    const place = props.place ?? "Unknown location";
    const sourceUrl = props.url ?? "https://earthquake.usgs.gov/";
    const distanceKm = haversineKm(origin, { lat, lng });
    const item: HazardItem = {
      id: `eq-${feature.id ?? `${lat},${lng},${at}`}`,
      kind: "earthquake",
      severity: earthquakeSeverity(mag),
      title: `M${mag.toFixed(1)} · ${place}`,
      summary: `${distanceKm.toFixed(0)} km from map center · USGS earthquake feed`,
      at,
      distanceKm,
      source: "USGS",
      sourceUrl,
      lat,
      lng,
    };
    quakes.push(item);
    if (props.tsunami === 1) {
      tsunamiFlags.push({
        ...item,
        id: `eq-tsu-${feature.id ?? item.id}`,
        kind: "tsunami",
        severity: mag >= 7 ? "warning" : "watch",
        title: `USGS tsunami flag · M${mag.toFixed(1)} ${place}`,
        summary:
          "USGS marked this event with a tsunami evaluation flag. Confirm official NWS / NTWC products — not a Google alert.",
        sourceUrl: "https://www.tsunami.gov/",
      });
    }
  }

  return { quakes, tsunamiFlags };
}

function mapNwsAlert(
  feature: NwsAlertFeature,
  kind: HazardItem["kind"],
  origin: LatLng,
): HazardItem | null {
  const props = feature.properties ?? {};
  const event = props.event ?? "Alert";
  const at = Date.parse(props.onset ?? props.effective ?? props.sent ?? "") || Date.now();
  const headline = (props.headline ?? event).trim();
  const area = props.areaDesc ? ` · ${props.areaDesc}` : "";
  const desc = (props.description ?? "").trim().replace(/\s+/g, " ");
  const summary = (desc.slice(0, 220) || `National Weather Service ${event}`) + area;
  const id = props.id ?? feature.id;
  if (!id) return null;
  return {
    id: `nws-${id}`,
    kind,
    severity: nwsSeverity(props.severity),
    title: headline,
    summary,
    at,
    distanceKm: null,
    source: "NWS",
    sourceUrl: props.web ?? "https://www.weather.gov/",
    lat: origin.lat,
    lng: origin.lng,
  };
}

async function fetchNwsEventAlerts(
  events: string[],
  kind: HazardItem["kind"],
  origin: LatLng,
  signal?: AbortSignal,
): Promise<HazardItem[]> {
  const url = new URL("https://api.weather.gov/alerts/active");
  url.searchParams.set("status", "actual");
  url.searchParams.set("message_type", "alert");
  url.searchParams.set("event", events.join(","));

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/geo+json", "User-Agent": APP },
  });
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  const data = (await res.json()) as NwsAlertsResponse;
  const out: HazardItem[] = [];
  for (const feature of data.features ?? []) {
    const item = mapNwsAlert(feature, kind, origin);
    if (item) out.push(item);
  }
  return out;
}

async function fetchNwsPointCoastal(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<HazardItem[]> {
  const url = new URL("https://api.weather.gov/alerts/active");
  url.searchParams.set("status", "actual");
  url.searchParams.set("point", `${origin.lat},${origin.lng}`);

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/geo+json", "User-Agent": APP },
  });
  if (!res.ok) throw new Error(`NWS point ${res.status}`);
  const data = (await res.json()) as NwsAlertsResponse;
  const out: HazardItem[] = [];
  for (const feature of data.features ?? []) {
    const event = (feature.properties?.event ?? "").toLowerCase();
    if (event.includes("tsunami")) {
      const item = mapNwsAlert(feature, "tsunami", origin);
      if (item) out.push(item);
    } else if (event.includes("coastal flood") || event.includes("high surf")) {
      const item = mapNwsAlert(feature, "coastal_flood", origin);
      if (item) out.push(item);
    }
  }
  return out;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function fetchTideBrief(origin: LatLng, signal?: AbortSignal): Promise<TideBrief | null> {
  const nearest = nearestTideStation(origin);
  if (!nearest) return null;

  const start = new Date();
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const url = new URL("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter");
  url.searchParams.set("product", "predictions");
  url.searchParams.set("application", "Harborbrief");
  url.searchParams.set("begin_date", formatYmd(start));
  url.searchParams.set("end_date", formatYmd(end));
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("station", nearest.station.id);
  url.searchParams.set("time_zone", "lst_ldt");
  url.searchParams.set("units", "english");
  url.searchParams.set("interval", "hilo");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`NOAA tides ${res.status}`);
  const data = (await res.json()) as TidePredictionsResponse;
  if (data.error?.message) throw new Error(data.error.message);

  const now = Date.now();
  let nextHigh: TideBrief["nextHigh"] = null;
  let nextLow: TideBrief["nextLow"] = null;
  for (const row of data.predictions ?? []) {
    const at = parseNoaaLocalTime(row.t);
    if (Number.isNaN(at) || at < now - 30 * 60 * 1000) continue;
    const heightFt = Number(row.v);
    if (Number.isNaN(heightFt)) continue;
    const type = (row.type ?? "").toUpperCase();
    if (type === "H" && !nextHigh) nextHigh = { at, heightFt };
    if (type === "L" && !nextLow) nextLow = { at, heightFt };
    if (nextHigh && nextLow) break;
  }

  return {
    stationId: nearest.station.id,
    stationName: nearest.station.name,
    distanceKm: nearest.distanceKm,
    nextHigh,
    nextLow,
    framing: tideFraming(nextHigh?.heightFt ?? null, nearest.distanceKm),
    sourceUrl: `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${nearest.station.id}`,
  };
}

function dedupeById(items: HazardItem[]): HazardItem[] {
  const seen = new Set<string>();
  const out: HazardItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Coastal & seismic brief from public USGS / NWS / NOAA feeds (no API keys).
 * Google Maps is not a tsunami/earthquake API — use it only for map context links in the UI.
 */
export async function fetchHazardsBrief(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<HazardsBrief> {
  const errors: string[] = [];

  const [eqResult, tsuNational, pointAlerts, tideResult] = await Promise.allSettled([
    fetchEarthquakes(origin, signal),
    // National tsunami products (rare); coastal flood stays point-local to avoid a US-wide dump.
    fetchNwsEventAlerts(
      ["Tsunami Warning", "Tsunami Advisory", "Tsunami Watch", "Tsunami Information Statement"],
      "tsunami",
      origin,
      signal,
    ),
    fetchNwsPointCoastal(origin, signal),
    fetchTideBrief(origin, signal),
  ]);

  let earthquakes: HazardItem[] = [];
  let tsunamiFromUsgs: HazardItem[] = [];
  if (eqResult.status === "fulfilled") {
    earthquakes = eqResult.value.quakes;
    tsunamiFromUsgs = eqResult.value.tsunamiFlags;
  } else {
    errors.push("USGS earthquakes unavailable");
  }

  const tsunamisNational = tsuNational.status === "fulfilled" ? tsuNational.value : [];
  if (tsuNational.status === "rejected") errors.push("NWS tsunami feed unavailable");

  const point = pointAlerts.status === "fulfilled" ? pointAlerts.value : [];
  if (pointAlerts.status === "rejected") errors.push("NWS local alerts unavailable");

  const tide = tideResult.status === "fulfilled" ? tideResult.value : null;
  if (tideResult.status === "rejected") errors.push("NOAA tide predictions unavailable");

  const tsunamis = dedupeById([
    ...tsunamisNational,
    ...point.filter((h) => h.kind === "tsunami"),
    ...tsunamiFromUsgs,
  ]);
  const coastalFloods = dedupeById(point.filter((h) => h.kind === "coastal_flood"));

  return {
    earthquakes,
    tsunamis,
    coastalFloods,
    tide,
    fetchedAt: Date.now(),
    errors,
  };
}

export function googleMapsContextUrl(lat: number, lng: number): string {
  return googleMapsUrl(lat, lng);
}
