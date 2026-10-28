import type { LatLng } from "../types";
import type { WeatherSnapshot } from "./types";

/** WMO Weather interpretation codes → short English labels. */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Mixed conditions";
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  weather_code: number;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
}

/**
 * Live weather from Open-Meteo (no API key, CORS-friendly).
 * @see https://open-meteo.com/en/docs
 */
export async function fetchWeather(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(origin.lat));
  url.searchParams.set("longitude", String(origin.lng));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;
  const current = data.current;
  if (!current) throw new Error("Open-Meteo returned no current weather");

  return {
    temperatureF: current.temperature_2m,
    humidityPct: current.relative_humidity_2m,
    windMph: current.wind_speed_10m,
    weatherCode: current.weather_code,
    summary: weatherCodeLabel(current.weather_code),
    fetchedAt: Date.now(),
  };
}
