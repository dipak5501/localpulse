"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Filters } from "@/components/Filters";
import { PlaceBriefPanel } from "@/components/PlaceBriefPanel";
import { PostPulseForm } from "@/components/PostPulseForm";
import { PulseFeed } from "@/components/PulseFeed";
import type { MapMode } from "@/components/PulseMap";
import { useAccessLayer } from "@/hooks/useAccessLayer";
import { useDisplayName } from "@/hooks/useDisplayName";
import { FALLBACK_LOCATION_NAME, useGeolocation } from "@/hooks/useGeolocation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePlaceBrief } from "@/hooks/usePlaceBrief";
import { useRemotePulses } from "@/hooks/useRemotePulses";
import { CATEGORIES } from "@/lib/categories";
import { generateDemoPulses } from "@/lib/demo-data";
import { snapToGrid } from "@/lib/geo";
import { MAX_STORED_PULSES, STORAGE_KEYS, parseIds, parsePulses } from "@/lib/storage";
import { rankPulses } from "@/lib/trending";
import type { Category, Pulse } from "@/lib/types";

const NO_PULSES: Pulse[] = [];
const NO_IDS: string[] = [];

const PulseMap = dynamic(() => import("@/components/PulseMap"), {
  ssr: false,
  loading: () => <MapPlaceholder label="Loading chart…" />,
});

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[color:var(--chart-bg)] text-sm text-[color:var(--muted)]">
      {label}
    </div>
  );
}

function statusLine(
  geo: ReturnType<typeof useGeolocation>,
  remote: ReturnType<typeof useRemotePulses>,
): string {
  if (geo.status === "locating") return "Finding your location…";
  const loc =
    geo.status === "ready"
      ? `Live location · accurate to ~${Math.round(geo.accuracyM)} m`
      : geo.status === "shared"
        ? "Showing a shared map link"
        : `${geo.reason} Showing ${FALLBACK_LOCATION_NAME} instead.`;
  if (!remote.enabled) return loc;
  if (remote.status === "connecting") return `${loc} · connecting…`;
  if (remote.status === "live") return `${loc} · live`;
  if (remote.status === "error") return `${loc} · offline (sign-in failed)`;
  return loc;
}

export function LocalPulseApp() {
  const geo = useGeolocation();
  const position = geo.status === "locating" ? null : geo.position;
  const displayName = useDisplayName();

  const [now, setNow] = useState(() => Date.now());
  const [radiusKm, setRadiusKm] = useState(3);
  const [activeCategories, setActiveCategories] = useState<ReadonlySet<Category>>(() => new Set(CATEGORIES));
  const [myPulses, setMyPulses] = useLocalStorage(STORAGE_KEYS.myPulses, NO_PULSES, parsePulses);
  const [upvotedIds, setUpvotedIds] = useLocalStorage(STORAGE_KEYS.upvoted, NO_IDS, parseIds);
  const localUpvoted = useMemo(() => new Set(upvotedIds), [upvotedIds]);
  const localOwnIds = useMemo(() => new Set(myPulses.map((p) => p.id)), [myPulses]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("pulses");

  const remote = useRemotePulses(position, radiusKm);
  const briefState = usePlaceBrief(position);
  const accessState = useAccessLayer(position, radiusKm);
  const accessLayer =
    accessState.status === "ready" || accessState.status === "loading" ? accessState.layer : null;
  const live = remote.enabled && remote.status === "live";
  const offlineDemo = !remote.enabled;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const seedLat = position ? snapToGrid(position).lat : null;
  const seedLng = position ? snapToGrid(position).lng : null;
  const [sessionStart] = useState(now);
  const demoPulses = useMemo(
    () =>
      !offlineDemo || seedLat === null || seedLng === null
        ? []
        : generateDemoPulses({ lat: seedLat, lng: seedLng }, sessionStart),
    [offlineDemo, seedLat, seedLng, sessionStart],
  );

  const upvoted = live ? remote.upvoted : localUpvoted;
  const ownIds = live ? remote.ownIds : localOwnIds;

  const ranked = useMemo(() => {
    if (!position) return [];
    if (live) {
      return rankPulses(remote.pulses, position, { radiusKm, now, categories: activeCategories });
    }
    const all = [...myPulses, ...demoPulses].map((p) =>
      localUpvoted.has(p.id) ? { ...p, upvotes: p.upvotes + 1 } : p,
    );
    return rankPulses(all, position, { radiusKm, now, categories: activeCategories });
  }, [position, live, remote.pulses, myPulses, demoPulses, localUpvoted, radiusKm, now, activeCategories]);

  const viewLat = position ? snapToGrid(position, 3).lat : 0;
  const viewLng = position ? snapToGrid(position, 3).lng : 0;
  const viewCenter = useMemo(() => ({ lat: viewLat, lng: viewLng }), [viewLat, viewLng]);

  const toggle = <T,>(set: ReadonlySet<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const handlePost = (text: string, category: Category) => {
    if (!position) return;
    setActiveCategories((prev) => (prev.has(category) ? prev : toggle(prev, category)));

    if (live) {
      void remote.post(text, category, position, displayName).then((created) => {
        if (created) {
          setNow(created.createdAt);
          setSelectedId(created.id);
        }
      });
      return;
    }

    const pulse: Pulse = {
      id: crypto.randomUUID(),
      text,
      category,
      lat: position.lat,
      lng: position.lng,
      createdAt: Date.now(),
      upvotes: 0,
      author: "you",
    };
    setNow(pulse.createdAt);
    setMyPulses((prev) => [pulse, ...prev].slice(0, MAX_STORED_PULSES));
    setSelectedId(pulse.id);
  };

  const mapModes: Array<{ id: MapMode; label: string }> = [
    { id: "pulses", label: "Pulses" },
    { id: "heat", label: "Heatmap" },
    { id: "access", label: "Access" },
  ];

  return (
    <div className="flex h-dvh flex-col-reverse bg-[color:var(--bg)] text-[color:var(--ink)] md:flex-row">
      <aside className="flex h-[55dvh] w-full flex-col border-[color:var(--line)] md:h-full md:w-[420px] md:border-r">
        <header className="space-y-2 border-b border-[color:var(--line)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-ink)]">
                Harborbrief
              </p>
              <h1 className="font-serif text-2xl leading-none tracking-tight text-[color:var(--ink)]">
                A living brief for the ground under your feet
              </h1>
            </div>
            <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent)] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
            </span>
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            LocalPulse · weather, place story, neighborhood access, and community pulses
          </p>
          <p className="text-xs text-[color:var(--muted)]">{statusLine(geo, remote)}</p>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <PlaceBriefPanel
            briefState={briefState}
            access={accessLayer}
            accessLoading={accessState.status === "loading"}
          />
          <Filters
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            activeCategories={activeCategories}
            onToggleCategory={(c) => setActiveCategories((prev) => toggle(prev, c))}
          />
          <PostPulseForm onPost={handlePost} />
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Trending nearby · {ranked.length}
            </h2>
            <PulseFeed
              pulses={ranked}
              now={now}
              selectedId={selectedId}
              upvoted={upvoted}
              ownIds={ownIds}
              onSelect={setSelectedId}
              onDelete={(id) => {
                if (live) {
                  void remote.remove(id);
                } else {
                  setMyPulses((prev) => prev.filter((p) => p.id !== id));
                  setUpvotedIds((prev) => prev.filter((x) => x !== id));
                }
                setSelectedId((prev) => (prev === id ? null : prev));
              }}
              onToggleUpvote={(id) => {
                if (live) void remote.toggleUpvote(id);
                else
                  setUpvotedIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  );
              }}
            />
          </div>
        </div>
      </aside>

      <main className="relative h-[45dvh] flex-1 md:h-full">
        <div
          role="radiogroup"
          aria-label="Map view"
          className="absolute right-3 top-3 z-[1000] flex rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--panel)]/95 p-0.5 text-xs font-medium shadow-md backdrop-blur"
        >
          {mapModes.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mapMode === id}
              onClick={() => setMapMode(id)}
              className={`rounded-md px-3 py-1.5 transition ${
                mapMode === id
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--muted)] hover:text-[color:var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {position ? (
          <PulseMap
            mode={mapMode}
            center={position}
            viewCenter={viewCenter}
            radiusKm={radiusKm}
            pulses={ranked}
            accessPoints={accessLayer?.points ?? []}
            selectedId={selectedId}
            now={now}
            onSelect={setSelectedId}
          />
        ) : (
          <MapPlaceholder label="Waiting for your location…" />
        )}
      </main>
    </div>
  );
}
