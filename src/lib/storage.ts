import { CATEGORIES } from "./categories";
import type { Pulse } from "./types";

export const STORAGE_KEYS = {
  myPulses: "localpulse:my-pulses:v1",
  upvoted: "localpulse:upvoted:v1",
} as const;

export const MAX_STORED_PULSES = 50;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function isPulse(value: unknown): value is Pulse {
  if (!isObject(value)) return false;
  const { id, text, category, lat, lng, createdAt, upvotes, author } = value;
  return (
    typeof id === "string" &&
    typeof text === "string" &&
    typeof author === "string" &&
    (CATEGORIES as readonly unknown[]).includes(category) &&
    [lat, lng, createdAt, upvotes].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(lat as number) <= 90 &&
    Math.abs(lng as number) <= 180
  );
}

/** Keeps only well-formed pulses; anything else in storage is ignored rather than crashing the app. */
export function parsePulses(raw: unknown): Pulse[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(isPulse).slice(0, MAX_STORED_PULSES);
}

export function parseIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((id): id is string => typeof id === "string");
}
