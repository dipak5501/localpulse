import { describe, expect, it } from "vitest";
import { generateDemoAccessPoints } from "./access-demo";

const LONG_BEACH = { lat: 33.7701, lng: -118.1937 };
const LONDON = { lat: 51.5074, lng: -0.1278 };

describe("generateDemoAccessPoints", () => {
  it("returns Long Beach–flavored sample points downtown", () => {
    const points = generateDemoAccessPoints(LONG_BEACH, 5);
    expect(points.length).toBeGreaterThan(5);
    expect(points.some((p) => /Memorial|Metro|Harbor|CVS|Whole Foods/i.test(p.name))).toBe(true);
    expect(points.every((p) => p.distanceKm <= 5)).toBe(true);
  });

  it("returns generic samples elsewhere", () => {
    const points = generateDemoAccessPoints(LONDON, 3);
    expect(points.length).toBeGreaterThan(0);
    expect(points.every((p) => p.id.startsWith("demo-"))).toBe(true);
  });
});
