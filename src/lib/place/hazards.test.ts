import { describe, expect, it } from "vitest";
import {
  earthquakeSeverity,
  nearestTideStation,
  nwsSeverity,
  parseNoaaLocalTime,
  tideFraming,
} from "./hazards";

describe("earthquakeSeverity", () => {
  it("scales with magnitude", () => {
    expect(earthquakeSeverity(2.7)).toBe("info");
    expect(earthquakeSeverity(4.2)).toBe("advisory");
    expect(earthquakeSeverity(5.1)).toBe("watch");
    expect(earthquakeSeverity(6.3)).toBe("warning");
    expect(earthquakeSeverity(7.2)).toBe("extreme");
  });
});

describe("nwsSeverity", () => {
  it("maps NWS severity strings", () => {
    expect(nwsSeverity("Extreme")).toBe("extreme");
    expect(nwsSeverity("Severe")).toBe("warning");
    expect(nwsSeverity("Moderate")).toBe("watch");
    expect(nwsSeverity("Minor")).toBe("advisory");
    expect(nwsSeverity(null)).toBe("info");
  });
});

describe("nearestTideStation", () => {
  it("finds Long Beach Inner Harbor area for CSULB coords", () => {
    const hit = nearestTideStation({ lat: 33.77, lng: -118.1937 });
    expect(hit).not.toBeNull();
    expect(hit!.station.state).toBe("CA");
    expect(hit!.distanceKm).toBeLessThan(10);
    expect(hit!.station.name.toLowerCase()).toMatch(/long beach|los angeles|san pedro|terminal/);
  });

  it("returns null far inland", () => {
    expect(nearestTideStation({ lat: 39.7392, lng: -104.9903 }, undefined, 80)).toBeNull();
  });
});

describe("parseNoaaLocalTime", () => {
  it("parses CO-OPS prediction timestamps", () => {
    const t = parseNoaaLocalTime("2026-10-28 10:31");
    expect(Number.isNaN(t)).toBe(false);
    const d = new Date(t);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(28);
  });
});

describe("tideFraming", () => {
  it("calls out elevated highs without claiming an official warning", () => {
    const text = tideFraming(7.2, 2.1);
    expect(text).toMatch(/elevated/i);
    expect(text).toMatch(/not an official flood warning/i);
  });
});
