import { haversineKm } from "./geo";
import type { Category, LatLng, Pulse, RankedPulse } from "./types";

/** How quickly posts decay with age. Higher values favour fresher posts. */
export const GRAVITY = 1.5;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hacker News–style time decay, weighted by proximity: a pulse at the edge of
 * the search radius scores half as much as an identical one right next to you.
 */
export function trendingScore(
  upvotes: number,
  ageHours: number,
  distanceKm: number,
  radiusKm: number,
): number {
  const recency = (Math.max(0, upvotes) + 1) / Math.pow(Math.max(0, ageHours) + 2, GRAVITY);
  const proximity = 1 - 0.5 * Math.min(distanceKm / radiusKm, 1);
  return recency * proximity;
}

export interface RankOptions {
  radiusKm: number;
  now: number;
  categories?: ReadonlySet<Category>;
}

export function rankPulses(
  pulses: readonly Pulse[],
  origin: LatLng,
  { radiusKm, now, categories }: RankOptions,
): RankedPulse[] {
  const ranked: RankedPulse[] = [];
  for (const pulse of pulses) {
    if (categories && !categories.has(pulse.category)) continue;
    const distanceKm = haversineKm(origin, pulse);
    if (distanceKm > radiusKm) continue;
    const ageHours = (now - pulse.createdAt) / HOUR_MS;
    ranked.push({ ...pulse, distanceKm, score: trendingScore(pulse.upvotes, ageHours, distanceKm, radiusKm) });
  }
  return ranked.sort((a, b) => b.score - a.score);
}
