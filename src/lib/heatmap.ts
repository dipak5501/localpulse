import type { RankedPulse } from "./types";

export interface HeatPoint {
  lat: number;
  lng: number;
  /** Intensity in [0, 1]. */
  weight: number;
}

/**
 * Converts ranked pulses into heat intensities. Square-root scaling keeps one
 * viral post from drowning out a cluster of moderately popular ones.
 */
export function toHeatPoints(pulses: readonly RankedPulse[], minWeight = 0.15): HeatPoint[] {
  const max = Math.max(0, ...pulses.map((p) => p.score));
  if (max === 0) return pulses.map(({ lat, lng }) => ({ lat, lng, weight: minWeight }));
  return pulses.map(({ lat, lng, score }) => ({
    lat,
    lng,
    weight: minWeight + (1 - minWeight) * Math.sqrt(score / max),
  }));
}

export type Rgba = [number, number, number, number];

const DEFAULT_STOPS: ReadonlyArray<[number, [number, number, number]]> = [
  [0.0, [56, 189, 248]],
  [0.45, [168, 85, 247]],
  [0.7, [236, 72, 153]],
  [1.0, [250, 204, 21]],
];

/** Builds a 256-entry lookup table mapping alpha intensity to a colour. */
export function buildPalette(stops = DEFAULT_STOPS): Rgba[] {
  const palette: Rgba[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const upper = stops.findIndex(([at]) => at >= t);
    const [t1, c1] = stops[Math.max(0, upper - 1)];
    const [t2, c2] = stops[Math.max(0, upper)];
    const f = t2 === t1 ? 0 : (t - t1) / (t2 - t1);
    palette.push([
      Math.round(c1[0] + (c2[0] - c1[0]) * f),
      Math.round(c1[1] + (c2[1] - c1[1]) * f),
      Math.round(c1[2] + (c2[2] - c1[2]) * f),
      i,
    ]);
  }
  return palette;
}

/** Recolours a greyscale alpha buffer in place using `palette`. */
export function colorize(pixels: Uint8ClampedArray, palette: readonly Rgba[], maxOpacity = 0.75): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 0) continue;
    const [r, g, b] = palette[alpha];
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = Math.round(alpha * maxOpacity);
  }
}
