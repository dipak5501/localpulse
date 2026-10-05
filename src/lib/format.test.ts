import { describe, expect, it } from "vitest";
import { formatAge, formatDistance } from "./format";

describe("formatDistance", () => {
  it.each([
    [0.001, "10 m"],
    [0.456, "460 m"],
    [1.234, "1.2 km"],
    [12.6, "13 km"],
  ])("formats %f km as %s", (km, expected) => {
    expect(formatDistance(km)).toBe(expected);
  });
});

describe("formatAge", () => {
  it.each([
    [10_000, "just now"],
    [5 * 60_000, "5m ago"],
    [3 * 60 * 60_000, "3h ago"],
    [50 * 60 * 60_000, "2d ago"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatAge(ms)).toBe(expected);
  });
});
