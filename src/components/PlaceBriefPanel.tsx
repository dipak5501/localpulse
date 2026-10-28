"use client";

import {
  ACCESS_KIND_META,
  googleMapsContextUrl,
  summarizeAccess,
  type AccessLayer,
  type HazardItem,
  type HazardSeverity,
  type HazardsBrief,
  type PlaceBrief,
} from "@/lib/place";
import { formatAge, formatDistance } from "@/lib/format";
import type { PlaceBriefState } from "@/hooks/usePlaceBrief";

interface PlaceBriefPanelProps {
  briefState: PlaceBriefState;
  access: AccessLayer | null;
  accessLoading: boolean;
  now: number;
}

function sourceBadge(label: string, tone: "live" | "demo" | "muted" = "live") {
  const toneClass =
    tone === "live"
      ? "border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]"
      : tone === "demo"
        ? "border-amber-700/25 bg-amber-50 text-amber-900"
        : "border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--muted)]";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}>
      {label}
    </span>
  );
}

function severityChip(severity: HazardSeverity) {
  const styles: Record<HazardSeverity, string> = {
    info: "border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--muted)]",
    advisory: "border-sky-700/25 bg-sky-50 text-sky-900",
    watch: "border-amber-700/30 bg-amber-50 text-amber-950",
    warning: "border-orange-700/35 bg-orange-50 text-orange-950",
    extreme: "border-red-800/40 bg-red-50 text-red-950",
  };
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function formatClock(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function HazardRow({
  item,
  googleEnabled,
  now,
}: {
  item: HazardItem;
  googleEnabled: boolean;
  now: number;
}) {
  const mapsUrl =
    googleEnabled && item.lat !== undefined && item.lng !== undefined
      ? googleMapsContextUrl(item.lat, item.lng)
      : null;

  return (
    <li className="rounded-md border border-[color:var(--line)] bg-[color:var(--bg)] px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {severityChip(item.severity)}
        {sourceBadge(item.source, "muted")}
        <span className="text-[10px] text-[color:var(--muted)]">{formatAge(Math.max(0, now - item.at))}</span>
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-[color:var(--ink)]">{item.title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--ink-2)]">{item.summary}</p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--accent-ink)] underline-offset-2 hover:underline"
        >
          Official source ↗
        </a>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--accent-ink)] underline-offset-2 hover:underline"
          >
            Google Maps ↗
          </a>
        )}
        {item.distanceKm !== null && (
          <span className="font-normal text-[color:var(--muted)]">{formatDistance(item.distanceKm)} away</span>
        )}
      </div>
    </li>
  );
}

function HazardsSection({
  hazards,
  googleEnabled,
  now,
}: {
  hazards: HazardsBrief;
  googleEnabled: boolean;
  now: number;
}) {
  const quakes = hazards.earthquakes.slice(0, 5);
  const tsunamis = hazards.tsunamis.slice(0, 4);
  const floods = hazards.coastalFloods.slice(0, 4);
  const quiet = quakes.length === 0 && tsunamis.length === 0 && floods.length === 0;

  return (
    <div className="space-y-2" aria-label="Coastal and seismic brief">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
          Coastal &amp; seismic brief
        </p>
        <div className="flex flex-wrap gap-1">
          {sourceBadge("USGS", "muted")}
          {sourceBadge("NWS", "muted")}
          {sourceBadge("NOAA", "muted")}
          {googleEnabled && sourceBadge("Google Maps")}
        </div>
      </div>
      <p className="text-[11px] leading-snug text-[color:var(--muted)]">
        Hazards come from USGS earthquakes and NWS / NOAA public feeds — not a Google tsunami or crisis API.
        {googleEnabled ? " Google Maps links open epicenter / place context when a key is set." : ""}
      </p>

      {hazards.tide && (
        <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">High tide</p>
            {sourceBadge("NOAA CO-OPS", "muted")}
            {hazards.tide.nextHigh && hazards.tide.nextHigh.heightFt >= 5.5 && severityChip("advisory")}
          </div>
          <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
            {hazards.tide.stationName}
            <span className="ml-1 font-normal text-[color:var(--muted)]">
              · {formatDistance(hazards.tide.distanceKm)}
            </span>
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-[color:var(--ink-2)]">
            {hazards.tide.nextHigh && (
              <li>
                Next high · {formatClock(hazards.tide.nextHigh.at)} · {hazards.tide.nextHigh.heightFt.toFixed(1)} ft
                MLLW
              </li>
            )}
            {hazards.tide.nextLow && (
              <li>
                Next low · {formatClock(hazards.tide.nextLow.at)} · {hazards.tide.nextLow.heightFt.toFixed(1)} ft MLLW
              </li>
            )}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--muted)]">{hazards.tide.framing}</p>
          <a
            href={hazards.tide.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex text-[11px] font-semibold text-[color:var(--accent-ink)] underline-offset-2 hover:underline"
          >
            NOAA tide predictions ↗
          </a>
        </div>
      )}

      {!hazards.tide && (
        <p className="text-xs text-[color:var(--muted)]">
          No NOAA tide gauge within ~80 km — high-tide briefing is coastal-only.
        </p>
      )}

      {tsunamis.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-900">Tsunami alerts</p>
          <ul className="space-y-1.5">
            {tsunamis.map((item) => (
              <HazardRow key={item.id} item={item} googleEnabled={googleEnabled} now={now} />
            ))}
          </ul>
        </div>
      )}

      {floods.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">Coastal flood alerts</p>
          <ul className="space-y-1.5">
            {floods.map((item) => (
              <HazardRow key={item.id} item={item} googleEnabled={googleEnabled} now={now} />
            ))}
          </ul>
        </div>
      )}

      {quakes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
            Recent earthquakes (≤500 km)
          </p>
          <ul className="space-y-1.5">
            {quakes.map((item) => (
              <HazardRow key={item.id} item={item} googleEnabled={googleEnabled} now={now} />
            ))}
          </ul>
        </div>
      )}

      {quiet && (
        <p className="text-xs text-[color:var(--muted)]">
          No active NWS tsunami / coastal-flood products and no M2.5+ quakes in range right now.
        </p>
      )}
    </div>
  );
}

function BriefBody({
  brief,
  access,
  accessLoading,
  now,
}: {
  brief: PlaceBrief;
  access: AccessLayer | null;
  accessLoading: boolean;
  now: number;
}) {
  const counts = access ? summarizeAccess(access.points) : null;
  const mapsPlaceUrl = brief.googleEnabled
    ? googleMapsContextUrl(brief.origin.lat, brief.origin.lng)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serif text-xl leading-tight tracking-tight text-[color:var(--ink)]">{brief.place.label}</p>
          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
            {[brief.place.region, brief.place.country].filter(Boolean).join(" · ") || "Place brief"}
          </p>
          {mapsPlaceUrl && (
            <a
              href={mapsPlaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex text-[11px] font-semibold text-[color:var(--accent-ink)] underline-offset-2 hover:underline"
            >
              Open place in Google Maps ↗
            </a>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {brief.place.source === "google" && sourceBadge("Google")}
          {brief.place.source === "bigdatacloud" && sourceBadge("Geocode")}
          {brief.place.source === "demo" && sourceBadge("Demo place", "demo")}
          {brief.googleEnabled && sourceBadge("Places ready")}
        </div>
      </div>

      {brief.weather && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-2 text-sm">
          <span className="font-semibold text-[color:var(--ink)]">
            {Math.round(brief.weather.temperatureF)}°F · {brief.weather.summary}
          </span>
          <span className="text-xs text-[color:var(--muted)]">
            Humidity {Math.round(brief.weather.humidityPct)}% · Wind {Math.round(brief.weather.windMph)} mph
          </span>
          {sourceBadge("Open-Meteo", "muted")}
        </div>
      )}

      {brief.hazards && (
        <HazardsSection hazards={brief.hazards} googleEnabled={brief.googleEnabled} now={now} />
      )}

      {brief.wiki && (
        <div className="space-y-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">Place story</p>
            {sourceBadge("Wikipedia", "muted")}
          </div>
          <p className="text-sm leading-relaxed text-[color:var(--ink-2)]">{brief.wiki.extract}</p>
          <a
            href={brief.wiki.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-semibold text-[color:var(--accent-ink)] underline-offset-2 hover:underline"
          >
            {brief.wiki.title} ↗
          </a>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
            Neighborhood access
          </p>
          <div className="flex flex-wrap gap-1">
            {accessLoading && sourceBadge("Loading…", "muted")}
            {access && !access.demo && access.source === "google" && sourceBadge("Google Places")}
            {access && !access.demo && access.source === "overpass" && sourceBadge("OSM Overpass")}
            {access?.demo && sourceBadge("Sample access", "demo")}
          </div>
        </div>
        {counts ? (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(Object.keys(ACCESS_KIND_META) as Array<keyof typeof ACCESS_KIND_META>).map((kind) => (
              <li
                key={kind}
                className="flex items-center gap-2 rounded-md border border-[color:var(--line)] bg-[color:var(--bg)] px-2 py-1.5 text-xs"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCESS_KIND_META[kind].color }}
                  aria-hidden
                />
                <span className="text-[color:var(--muted)]">{ACCESS_KIND_META[kind].short}</span>
                <span className="ml-auto font-mono font-semibold text-[color:var(--ink)]">{counts[kind]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[color:var(--muted)]">Scanning clinics, groceries, transit & parks…</p>
        )}
        {access?.error && (
          <p className="text-[11px] leading-snug text-amber-800">{access.error}</p>
        )}
      </div>

      {brief.errors.length > 0 && (
        <p className="text-[11px] text-[color:var(--muted)]">{brief.errors.join(" · ")}</p>
      )}
    </div>
  );
}

export function PlaceBriefPanel({ briefState, access, accessLoading, now }: PlaceBriefPanelProps) {
  const brief =
    briefState.status === "ready" || briefState.status === "loading" || briefState.status === "error"
      ? briefState.brief
      : null;

  return (
    <section
      aria-label="Place brief"
      className="rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--panel)] p-3 shadow-[0_1px_0_rgba(18,32,42,0.04)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
          Living place brief
        </h2>
        {briefState.status === "loading" && (
          <span className="text-[10px] font-medium text-[color:var(--accent-ink)]">Updating…</span>
        )}
      </div>

      {brief ? (
        <BriefBody brief={brief} access={access} accessLoading={accessLoading} now={now} />
      ) : briefState.status === "loading" ? (
        <p className="text-sm text-[color:var(--muted)]">Gathering weather, hazards, place story, and access…</p>
      ) : briefState.status === "error" ? (
        <p className="text-sm text-amber-800">{briefState.message}</p>
      ) : (
        <p className="text-sm text-[color:var(--muted)]">Waiting for a location to brief…</p>
      )}
    </section>
  );
}
