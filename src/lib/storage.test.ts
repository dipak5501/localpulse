import { describe, expect, it } from "vitest";
import { MAX_STORED_PULSES, isPulse, parseIds, parsePulses } from "./storage";
import type { Pulse } from "./types";

const valid: Pulse = {
  id: "a",
  text: "hello",
  category: "food",
  lat: 33.77,
  lng: -118.19,
  createdAt: 1,
  upvotes: 0,
  author: "you",
};

describe("isPulse", () => {
  it("accepts a well-formed pulse", () => {
    expect(isPulse(valid)).toBe(true);
  });

  it.each([
    ["null", null],
    ["unknown category", { ...valid, category: "crypto" }],
    ["string coordinates", { ...valid, lat: "33.7" }],
    ["out-of-range latitude", { ...valid, lat: 120 }],
    ["NaN upvotes", { ...valid, upvotes: Number.NaN }],
    ["missing author", { ...valid, author: undefined }],
  ])("rejects %s", (_, value) => {
    expect(isPulse(value)).toBe(false);
  });
});

describe("parsePulses", () => {
  it("returns null for non-arrays so the caller falls back to defaults", () => {
    expect(parsePulses({ nope: true })).toBeNull();
  });

  it("drops malformed entries and keeps valid ones", () => {
    expect(parsePulses([valid, { id: 1 }, "junk"])).toEqual([valid]);
  });

  it("caps the number of stored pulses", () => {
    const many = Array.from({ length: MAX_STORED_PULSES + 10 }, (_, i) => ({ ...valid, id: String(i) }));
    expect(parsePulses(many)).toHaveLength(MAX_STORED_PULSES);
  });
});

describe("parseIds", () => {
  it("keeps only strings", () => {
    expect(parseIds(["a", 2, null, "b"])).toEqual(["a", "b"]);
  });

  it("returns null for non-arrays", () => {
    expect(parseIds("a")).toBeNull();
  });
});
