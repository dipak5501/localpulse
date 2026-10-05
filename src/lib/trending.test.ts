import { describe, expect, it } from "vitest";
import { offsetPoint } from "./geo";
import { rankPulses, trendingScore } from "./trending";
import type { Pulse } from "./types";

const ORIGIN = { lat: 40.7128, lng: -74.006 };
const NOW = Date.UTC(2026, 0, 1);
const HOUR = 60 * 60 * 1000;

function pulse(overrides: Partial<Pulse> & { distanceKm?: number } = {}): Pulse {
  const { distanceKm = 1, ...rest } = overrides;
  const point = offsetPoint(ORIGIN, distanceKm, 90);
  return {
    id: Math.random().toString(36),
    text: "test",
    category: "event",
    lat: point.lat,
    lng: point.lng,
    createdAt: NOW,
    upvotes: 0,
    author: "tester",
    ...rest,
  };
}

describe("trendingScore", () => {
  it("favours newer posts with equal votes", () => {
    expect(trendingScore(10, 1, 1, 5)).toBeGreaterThan(trendingScore(10, 5, 1, 5));
  });

  it("favours more upvotes at equal age", () => {
    expect(trendingScore(50, 2, 1, 5)).toBeGreaterThan(trendingScore(5, 2, 1, 5));
  });

  it("favours closer posts, halving the score at the radius edge", () => {
    const near = trendingScore(10, 1, 0, 5);
    const edge = trendingScore(10, 1, 5, 5);
    expect(edge).toBeCloseTo(near / 2, 9);
  });

  it("handles negative inputs without producing NaN", () => {
    expect(Number.isFinite(trendingScore(-3, -1, 0, 5))).toBe(true);
  });
});

describe("rankPulses", () => {
  it("excludes pulses outside the radius", () => {
    const ranked = rankPulses([pulse({ id: "in", distanceKm: 2 }), pulse({ id: "out", distanceKm: 8 })], ORIGIN, {
      radiusKm: 5,
      now: NOW,
    });
    expect(ranked.map((p) => p.id)).toEqual(["in"]);
  });

  it("filters by category when provided", () => {
    const ranked = rankPulses(
      [pulse({ id: "food", category: "food" }), pulse({ id: "music", category: "music" })],
      ORIGIN,
      { radiusKm: 5, now: NOW, categories: new Set(["music"]) },
    );
    expect(ranked.map((p) => p.id)).toEqual(["music"]);
  });

  it("sorts by descending score and annotates distance", () => {
    const ranked = rankPulses(
      [
        pulse({ id: "old", upvotes: 20, createdAt: NOW - 48 * HOUR }),
        pulse({ id: "hot", upvotes: 20, createdAt: NOW - HOUR }),
        pulse({ id: "cold", upvotes: 0, createdAt: NOW - HOUR }),
      ],
      ORIGIN,
      { radiusKm: 5, now: NOW },
    );
    expect(ranked.map((p) => p.id)).toEqual(["hot", "cold", "old"]);
    expect(ranked[0].distanceKm).toBeCloseTo(1, 6);
  });
});
