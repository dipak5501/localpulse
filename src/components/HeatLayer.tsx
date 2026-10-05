"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";
import { buildPalette, colorize, type HeatPoint } from "@/lib/heatmap";

const RADIUS_PX = 28;
const BLUR_PX = 18;

/** Pre-rendered blurred dot, stamped once per point at its weight as opacity. */
function createStamp(): HTMLCanvasElement {
  const r = RADIUS_PX + BLUR_PX;
  const stamp = document.createElement("canvas");
  stamp.width = stamp.height = r * 2;
  const ctx = stamp.getContext("2d")!;
  // Draw the circle off-canvas and cast its blurred shadow back into view.
  ctx.shadowOffsetX = ctx.shadowOffsetY = r * 2;
  ctx.shadowBlur = BLUR_PX;
  ctx.shadowColor = "black";
  ctx.beginPath();
  ctx.arc(-r, -r, RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
  return stamp;
}

class CanvasHeatLayer extends L.Layer {
  private canvas = document.createElement("canvas");
  private stamp = createStamp();
  private palette = buildPalette();
  private points: HeatPoint[] = [];

  setPoints(points: HeatPoint[]) {
    this.points = points;
    if (this._map) this.redraw();
  }

  onAdd(map: L.Map) {
    this.canvas.className = "leaflet-zoom-hide";
    this.canvas.style.pointerEvents = "none";
    map.getPanes().overlayPane.appendChild(this.canvas);
    map.on("moveend zoomend resize", this.redraw, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map) {
    map.off("moveend zoomend resize", this.redraw, this);
    this.canvas.remove();
    return this;
  }

  private redraw() {
    const map = this._map;
    if (!map) return;
    const size = map.getSize();
    this.canvas.width = size.x;
    this.canvas.height = size.y;
    L.DomUtil.setPosition(this.canvas, map.containerPointToLayerPoint([0, 0]));

    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || size.x === 0 || size.y === 0) return;
    ctx.clearRect(0, 0, size.x, size.y);

    const offset = RADIUS_PX + BLUR_PX;
    for (const { lat, lng, weight } of this.points) {
      const p = map.latLngToContainerPoint([lat, lng]);
      ctx.globalAlpha = weight;
      ctx.drawImage(this.stamp, p.x - offset, p.y - offset);
    }

    const image = ctx.getImageData(0, 0, size.x, size.y);
    colorize(image.data, this.palette);
    ctx.putImageData(image, 0, 0);
  }
}

export function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const layer = useMemo(() => new CanvasHeatLayer(), []);

  useEffect(() => {
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, layer]);

  useEffect(() => {
    layer.setPoints(points);
  }, [layer, points]);

  return null;
}
