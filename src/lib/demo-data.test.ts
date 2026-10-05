import { describe, expect, it } from "vitest";
import { generateDemoPulses } from "./demo-data";
import { haversineKm } from "./geo";

const ORIGIN = { lat: 51.5074, lng: -0.1278 };
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
});
