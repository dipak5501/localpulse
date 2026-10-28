"use client";

import { ACCESS_KIND_META, summarizeAccess, type AccessLayer, type PlaceBrief } from "@/lib/place";
import type { PlaceBriefState } from "@/hooks/usePlaceBrief";

interface PlaceBriefPanelProps {
  briefState: PlaceBriefState;
  access: AccessLayer | null;
  accessLoading: boolean;
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

function BriefBody({ brief, access, accessLoading }: { brief: PlaceBrief; access: AccessLayer | null; accessLoading: boolean }) {
  const counts = access ? summarizeAccess(access.points) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serif text-xl leading-tight tracking-tight text-[color:var(--ink)]">{brief.place.label}</p>
          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
            {[brief.place.region, brief.place.country].filter(Boolean).join(" · ") || "Place brief"}
          </p>
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

export function PlaceBriefPanel({ briefState, access, accessLoading }: PlaceBriefPanelProps) {
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
        <BriefBody brief={brief} access={access} accessLoading={accessLoading} />
      ) : briefState.status === "loading" ? (
        <p className="text-sm text-[color:var(--muted)]">Gathering weather, place story, and access…</p>
      ) : briefState.status === "error" ? (
        <p className="text-sm text-amber-800">{briefState.message}</p>
      ) : (
        <p className="text-sm text-[color:var(--muted)]">Waiting for a location to brief…</p>
      )}
    </section>
  );
}
