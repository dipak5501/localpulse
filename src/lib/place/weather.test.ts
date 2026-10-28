import { describe, expect, it } from "vitest";
import { weatherCodeLabel } from "./weather";

describe("weatherCodeLabel", () => {
  it("maps common WMO codes", () => {
    expect(weatherCodeLabel(0)).toBe("Clear");
    expect(weatherCodeLabel(3)).toBe("Overcast");
    expect(weatherCodeLabel(61)).toBe("Rain");
    expect(weatherCodeLabel(95)).toBe("Thunderstorm");
  });

  it("falls back for unknown codes", () => {
    expect(weatherCodeLabel(999)).toBe("Mixed conditions");
  });
});
