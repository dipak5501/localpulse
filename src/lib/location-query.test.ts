import { describe, expect, it } from "vitest";
import { locationQueryString, parseLocationQuery } from "./location-query";

describe("parseLocationQuery", () => {
  it("reads valid lat/lng", () => {
    expect(parseLocationQuery("?lat=33.7701&lng=-118.1937")).toEqual({
      lat: 33.7701,
      lng: -118.1937,
    });
  });

  it("accepts a search string without a leading ?", () => {
    expect(parseLocationQuery("lat=0&lng=0")).toEqual({ lat: 0, lng: 0 });
  });

  it.each(["", "?lat=abc&lng=1", "?lat=91&lng=0", "?lat=0&lng=200", "?lat=1"])(
    "rejects %s",
    (search) => {
      expect(parseLocationQuery(search)).toBeNull();
    },
  );
});

describe("locationQueryString", () => {
  it("formats a stable query for sharing", () => {
    expect(locationQueryString({ lat: 33.7701, lng: -118.1937 })).toBe("?lat=33.77010&lng=-118.19370");
  });
});
