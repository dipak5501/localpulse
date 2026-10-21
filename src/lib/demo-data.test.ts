import { describe, expect, it } from "vitest";
import { generateDemoPulses, isCoastalSouthernCalifornia, randomBearing } from "./demo-data";
import { haversineKm } from "./geo";

const ORIGIN = { lat: 51.5074, lng: -0.1278 };
const LONG_BEACH = { lat: 33.7701, lng: -118.1937 };
const NOW = Date.UTC(2026, 0, 1);

describe("generateDemoPulses", () => {
  it("is deterministic for the same location", () => {
    expect(generateDemoPulses(ORIGIN, NOW)).toEqual(generateDemoPulses(ORIGIN, NOW));
  });

  it("produces different data for different locations", () => {
    const a = generateDemoPulses(ORIGIN, NOW).map((p) => p.text);
    const b = generateDemoPulses({ lat: 48.8566, lng: 2.3522 }, NOW).map((p) => p.text);
    expect(a).not.toEqual(b);
  });

  it("keeps every pulse within ~10 km and in the past 24 hours", () => {
    for (const p of generateDemoPulses(ORIGIN, NOW)) {
      expect(haversineKm(ORIGIN, p)).toBeLessThan(10);
      expect(p.createdAt).toBeLessThanOrEqual(NOW);
      expect(NOW - p.createdAt).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });

  it("uses Long Beach–specific copy near downtown LB", () => {
    const texts = generateDemoPulses(LONG_BEACH, NOW).map((p) => p.text);
    expect(texts.some((t) => /Belmont|Pike|Queen Mary|Rainbow Harbor|CSULB/i.test(t))).toBe(true);
  });
});

describe("coastal bearing bias", () => {
  it("detects Long Beach as coastal SoCal", () => {
    expect(isCoastalSouthernCalifornia(LONG_BEACH)).toBe(true);
    expect(isCoastalSouthernCalifornia(ORIGIN)).toBe(false);
  });

  it("keeps coastal bearings in the inland arc", () => {
    const rand = (() => {
      let i = 0;
      const seq = [0, 0.25, 0.5, 0.75, 0.99];
      return () => seq[i++ % seq.length];
    })();
    for (let n = 0; n < 5; n++) {
      const bearing = randomBearing(rand, true);
      const inland = bearing >= 300 || bearing <= 90;
      expect(inland).toBe(true);
    }
  });
});
