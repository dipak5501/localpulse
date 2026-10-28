"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { HeatLayer } from "@/components/HeatLayer";
import { CATEGORY_META } from "@/lib/categories";
import { formatAge, formatDistance } from "@/lib/format";
import { toHeatPoints } from "@/lib/heatmap";
import { ACCESS_KIND_META, type AccessPoint } from "@/lib/place";
import type { LatLng, RankedPulse } from "@/lib/types";

export type MapMode = "pulses" | "heat" | "access";

interface PulseMapProps {
  mode: MapMode;
  center: LatLng;
  /** A coarsened `center` that only changes on meaningful movement, so GPS jitter doesn't re-fit the map. */
  viewCenter: LatLng;
  radiusKm: number;
  pulses: RankedPulse[];
  accessPoints: AccessPoint[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
}

function FitToRadius({ center, radiusKm }: { center: LatLng; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000), { padding: [24, 24] });
  }, [map, center.lat, center.lng, radiusKm]);
  return null;
}

function FlyToPulse({ pulse }: { pulse: RankedPulse | undefined }) {
  const map = useMap();
  const lat = pulse?.lat;
  const lng = pulse?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

/** Free OSM tiles by default (no key). Optional Google raster tiles when the Maps key is set. */
function basemapTiles() {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (googleKey) {
    return {
      url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      attribution: '&copy; <a href="https://maps.google.com/">Google</a>',
      subdomains: "0123",
      maxZoom: 20,
    } as const;
  }
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abc",
    maxZoom: 19,
  } as const;
}

export default function PulseMap({
  mode,
  center,
  viewCenter,
  radiusKm,
  pulses,
  accessPoints,
  selectedId,
  now,
  onSelect,
}: PulseMapProps) {
  const maxScore = pulses[0]?.score ?? 1;
  const heatPoints = useMemo(() => toHeatPoints(pulses), [pulses]);
  const tiles = useMemo(() => basemapTiles(), []);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        attribution={tiles.attribution}
        url={tiles.url}
        subdomains={tiles.subdomains}
        maxZoom={tiles.maxZoom}
      />
      <FitToRadius center={viewCenter} radiusKm={radiusKm} />
      {mode !== "access" && <FlyToPulse pulse={pulses.find((p) => p.id === selectedId)} />}

      <Circle
        center={[center.lat, center.lng]}
        radius={radiusKm * 1000}
        pathOptions={{ color: "#0f766e", weight: 1.5, dashArray: "5 7", fillColor: "#0f766e", fillOpacity: 0.04 }}
        interactive={false}
      />

      {mode === "heat" && <HeatLayer points={heatPoints} />}

      {mode === "pulses" &&
        [...pulses].reverse().map((pulse) => {
          const { color, label } = CATEGORY_META[pulse.category];
          const selected = pulse.id === selectedId;
          return (
            <CircleMarker
              key={pulse.id}
              center={[pulse.lat, pulse.lng]}
              radius={6 + 12 * (pulse.score / maxScore)}
              pathOptions={{
                color: selected ? "#12202a" : color,
                weight: selected ? 3 : 1,
                fillColor: color,
                fillOpacity: selected ? 0.95 : 0.65,
              }}
              eventHandlers={{ click: () => onSelect(pulse.id) }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{pulse.text}</p>
                  <p className="text-xs opacity-70">
                    {label} · {formatDistance(pulse.distanceKm)} · {formatAge(now - pulse.createdAt)} ·{" "}
                    {pulse.upvotes} upvotes
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      {mode === "access" &&
        accessPoints.map((point) => {
          const meta = ACCESS_KIND_META[point.kind];
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={8}
              pathOptions={{
                color: "#12202a",
                weight: 1,
                fillColor: meta.color,
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{point.name}</p>
                  <p className="text-xs opacity-70">
                    {meta.label} · {formatDistance(point.distanceKm)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      <CircleMarker
        center={[center.lat, center.lng]}
        radius={8}
        pathOptions={{ color: "#fffcf7", weight: 3, fillColor: "#0f766e", fillOpacity: 1 }}
        interactive={false}
      />
    </MapContainer>
  );
}
