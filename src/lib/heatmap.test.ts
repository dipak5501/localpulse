import { describe, expect, it } from "vitest";
import { buildPalette, colorize, toHeatPoints } from "./heatmap";
import type { RankedPulse } from "./types";

const ranked = (score: number): RankedPulse => ({
  id: String(score),
  text: "",
  category: "event",
  lat: 33.77,
  lng: -118.19,
  createdAt: 0,
  upvotes: 0,
  author: "",
  distanceKm: 0,
  score,
});

describe("toHeatPoints", () => {
  it("gives the top pulse full weight and keeps others above the floor", () => {
    const points = toHeatPoints([ranked(4), ranked(1), ranked(0)], 0.2);
    expect(points[0].weight).toBe(1);
    expect(points[1].weight).toBeCloseTo(0.2 + 0.8 * 0.5, 9);
    expect(points[2].weight).toBe(0.2);
  });

  it("handles all-zero scores without dividing by zero", () => {
    expect(toHeatPoints([ranked(0), ranked(0)], 0.3).map((p) => p.weight)).toEqual([0.3, 0.3]);
  });

  it("returns an empty array for no pulses", () => {
    expect(toHeatPoints([])).toEqual([]);
  });
});

describe("buildPalette", () => {
  it("has 256 entries whose alpha matches the index", () => {
    const palette = buildPalette();
    expect(palette).toHaveLength(256);
    expect(palette.every(([, , , a], i) => a === i)).toBe(true);
  });

  it("starts and ends at the first and last stop colours", () => {
    const palette = buildPalette([
      [0, [0, 0, 0]],
      [1, [255, 255, 255]],
    ]);
    expect(palette[0].slice(0, 3)).toEqual([0, 0, 0]);
    expect(palette[255].slice(0, 3)).toEqual([255, 255, 255]);
    expect(palette[128][0]).toBeCloseTo(128, -1);
  });
});

describe("colorize", () => {
  it("recolours visible pixels and leaves transparent ones untouched", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 200]);
    const palette = buildPalette([
      [0, [10, 20, 30]],
      [1, [10, 20, 30]],
    ]);
    colorize(pixels, palette, 0.5);
    expect([...pixels]).toEqual([0, 0, 0, 0, 10, 20, 30, 100]);
  });
});
