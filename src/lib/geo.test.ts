import { describe, expect, it } from "vitest";
import { haversineKm, offsetPoint, snapToGrid } from "./geo";

const SF = { lat: 37.7749, lng: -122.4194 };
const LA = { lat: 34.0522, lng: -118.2437 };

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(SF, SF)).toBe(0);
  });

  it("matches the known SF to LA distance", () => {
    expect(haversineKm(SF, LA)).toBeCloseTo(559, 0);
  });

  it("is symmetric", () => {
    expect(haversineKm(SF, LA)).toBeCloseTo(haversineKm(LA, SF), 9);
  });
});

describe("offsetPoint", () => {
  it.each([0, 90, 180, 270, 45])("lands the requested distance away at bearing %i", (bearing) => {
    const moved = offsetPoint(SF, 5, bearing);
    expect(haversineKm(SF, moved)).toBeCloseTo(5, 6);
  });

  it("moves north when bearing is 0", () => {
    const moved = offsetPoint(SF, 1, 0);
    expect(moved.lat).toBeGreaterThan(SF.lat);
    expect(moved.lng).toBeCloseTo(SF.lng, 9);
  });

  it("wraps longitude across the antimeridian", () => {
    const moved = offsetPoint({ lat: 0, lng: 179.99 }, 10, 90);
    expect(moved.lng).toBeLessThan(-179);
  });
});

describe("snapToGrid", () => {
  it("maps nearby points to the same cell", () => {
    expect(snapToGrid({ lat: 37.77491, lng: -122.41942 })).toEqual(
      snapToGrid({ lat: 37.77012, lng: -122.42401 }),
    );
  });
});
