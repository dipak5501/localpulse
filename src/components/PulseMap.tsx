"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { HeatLayer } from "@/components/HeatLayer";
import { CATEGORY_META } from "@/lib/categories";
import { formatAge, formatDistance } from "@/lib/format";
import { toHeatPoints } from "@/lib/heatmap";
import type { LatLng, RankedPulse } from "@/lib/types";

export type MapMode = "pulses" | "heat";

interface PulseMapProps {
  mode: MapMode;
  center: LatLng;
  /** A coarsened `center` that only changes on meaningful movement, so GPS jitter doesn't re-fit the map. */
  viewCenter: LatLng;
  radiusKm: number;
  pulses: RankedPulse[];
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

export default function PulseMap({
  mode,
  center,
  viewCenter,
  radiusKm,
  pulses,
  selectedId,
  now,
  onSelect,
}: PulseMapProps) {
  const maxScore = pulses[0]?.score ?? 1;
  const heatPoints = useMemo(() => toHeatPoints(pulses), [pulses]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <FitToRadius center={viewCenter} radiusKm={radiusKm} />
      <FlyToPulse pulse={pulses.find((p) => p.id === selectedId)} />

      <Circle
        center={[center.lat, center.lng]}
        radius={radiusKm * 1000}
        pathOptions={{ color: "#38bdf8", weight: 1, dashArray: "6 6", fillOpacity: 0.04 }}
        interactive={false}
      />

      {mode === "heat" && <HeatLayer points={heatPoints} />}

      {mode === "pulses" && [...pulses].reverse().map((pulse) => {
        const { color, label } = CATEGORY_META[pulse.category];
        const selected = pulse.id === selectedId;
        return (
          <CircleMarker
            key={pulse.id}
            center={[pulse.lat, pulse.lng]}
            radius={6 + 12 * (pulse.score / maxScore)}
            pathOptions={{
              color: selected ? "#ffffff" : color,
              weight: selected ? 3 : 1,
              fillColor: color,
              fillOpacity: selected ? 0.9 : 0.55,
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

      <CircleMarker
        center={[center.lat, center.lng]}
        radius={8}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#3b82f6", fillOpacity: 1 }}
        interactive={false}
      />
    </MapContainer>
  );
}
