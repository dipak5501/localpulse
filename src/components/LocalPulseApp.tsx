"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Filters } from "@/components/Filters";
import { PostPulseForm } from "@/components/PostPulseForm";
import { PulseFeed } from "@/components/PulseFeed";
import type { MapMode } from "@/components/PulseMap";
import { FALLBACK_LOCATION_NAME, useGeolocation } from "@/hooks/useGeolocation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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
  loading: () => <MapPlaceholder label="Loading map…" />,
});

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-sm text-zinc-500">{label}</div>
  );
}

export function LocalPulseApp() {
  const geo = useGeolocation();
  const position = geo.status === "locating" ? null : geo.position;

  const [now, setNow] = useState(() => Date.now());
  const [radiusKm, setRadiusKm] = useState(3);
  const [activeCategories, setActiveCategories] = useState<ReadonlySet<Category>>(() => new Set(CATEGORIES));
  const [myPulses, setMyPulses] = useLocalStorage(STORAGE_KEYS.myPulses, NO_PULSES, parsePulses);
  const [upvotedIds, setUpvotedIds] = useLocalStorage(STORAGE_KEYS.upvoted, NO_IDS, parseIds);
  const upvoted = useMemo(() => new Set(upvotedIds), [upvotedIds]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("pulses");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const seedLat = position ? snapToGrid(position).lat : null;
  const seedLng = position ? snapToGrid(position).lng : null;
  const [sessionStart] = useState(now);
  const demoPulses = useMemo(
    () => (seedLat === null || seedLng === null ? [] : generateDemoPulses({ lat: seedLat, lng: seedLng }, sessionStart)),
    [seedLat, seedLng, sessionStart],
  );

  const ranked = useMemo(() => {
    if (!position) return [];
    const all = [...myPulses, ...demoPulses].map((p) => (upvoted.has(p.id) ? { ...p, upvotes: p.upvotes + 1 } : p));
    return rankPulses(all, position, { radiusKm, now, categories: activeCategories });
  }, [position, myPulses, demoPulses, upvoted, radiusKm, now, activeCategories]);

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
    setActiveCategories((prev) => (prev.has(category) ? prev : toggle(prev, category)));
    setSelectedId(pulse.id);
  };

  return (
    <div className="flex h-dvh flex-col-reverse bg-zinc-950 text-zinc-100 md:flex-row">
      <aside className="flex h-[55dvh] w-full flex-col border-zinc-800 md:h-full md:w-[400px] md:border-r">
        <header className="space-y-1 border-b border-zinc-800 px-5 py-4">
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
            </span>
            LocalPulse
          </h1>
          <p className="text-xs text-zinc-500">
            {geo.status === "locating" && "Finding your location…"}
            {geo.status === "ready" && `Live location · accurate to ~${Math.round(geo.accuracyM)} m`}
            {geo.status === "fallback" && `${geo.reason} Showing ${FALLBACK_LOCATION_NAME} instead.`}
          </p>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <Filters
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            activeCategories={activeCategories}
            onToggleCategory={(c) => setActiveCategories((prev) => toggle(prev, c))}
          />
          <PostPulseForm onPost={handlePost} />
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Trending nearby · {ranked.length}
            </h2>
            <PulseFeed
              pulses={ranked}
              now={now}
              selectedId={selectedId}
              upvoted={upvoted}
              onSelect={setSelectedId}
              onToggleUpvote={(id) =>
                setUpvotedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
            />
          </div>
        </div>
      </aside>

      <main className="relative h-[45dvh] flex-1 md:h-full">
        <div
          role="radiogroup"
          aria-label="Map view"
          className="absolute right-3 top-3 z-[1000] flex rounded-lg border border-zinc-700 bg-zinc-900/90 p-0.5 text-xs font-medium shadow-lg backdrop-blur"
        >
          {(["pulses", "heat"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={mapMode === mode}
              onClick={() => setMapMode(mode)}
              className={`rounded-md px-3 py-1.5 transition ${
                mapMode === mode ? "bg-sky-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {mode === "pulses" ? "Pulses" : "Heatmap"}
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
