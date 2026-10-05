import { CATEGORIES } from "./categories";
import { offsetPoint } from "./geo";
import type { Category, LatLng, Pulse } from "./types";

const TEMPLATES: Record<Category, string[]> = {
  event: [
    "Pop-up night market just opened, tons of stalls",
    "Free outdoor movie screening starting soon",
    "Farmers market is packed today",
    "Art walk happening on this block, galleries open late",
    "Startup meetup with free pizza, come through",
  ],
  food: [
    "New ramen spot has no line right now",
    "Taco truck parked here, best al pastor around",
    "Bakery just pulled fresh croissants out",
    "Happy hour deals going until 7",
    "Coffee shop doing free refills today",
  ],
  music: [
    "Live jazz trio playing in the plaza",
    "Street performer drawing a huge crowd",
    "Open mic tonight, sign-ups still open",
    "DJ set on the rooftop, vibes are immaculate",
  ],
  sports: [
    "Pickup basketball game needs two more players",
    "Big screen showing the game at the corner bar",
    "Group run leaving from here in 15 min",
    "Soccer match in the park, come watch",
  ],
  alert: [
    "Road closed ahead, take the side street",
    "Heavy traffic on the main avenue",
    "Power is out on this block",
    "Lost dog spotted near the park, golden retriever",
  ],
  chatter: [
    "Sunset from this spot is unreal right now",
    "Anyone know why there are so many helicopters?",
    "Found a great quiet spot to work from",
    "Huge line forming here, what's going on?",
  ],
};

const AUTHORS = ["maya", "jordan.k", "sam_r", "alex", "priya", "chris.w", "noor", "leo", "taylor", "dev_ops_dan"];

/** Small, fast, seedable PRNG so demo data is stable for a given location. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(items: readonly T[], rand: () => number) => items[Math.floor(rand() * items.length)];

/**
 * Generates realistic-looking pulses around `origin`. Most cluster around a
 * few hotspots so the map shows meaningful density rather than uniform noise.
 */
export function generateDemoPulses(origin: LatLng, now: number, count = 45): Pulse[] {
  const rand = mulberry32(Math.round(origin.lat * 1000) * 31 + Math.round(origin.lng * 1000));
  const hotspots = Array.from({ length: 3 }, () => offsetPoint(origin, 0.5 + rand() * 4, rand() * 360));
  const nextTemplate = Object.fromEntries(
    CATEGORIES.map((c) => [c, Math.floor(rand() * TEMPLATES[c].length)]),
  ) as Record<Category, number>;

  return Array.from({ length: count }, (_, i) => {
    const nearHotspot = rand() < 0.6;
    const point = nearHotspot
      ? offsetPoint(pick(hotspots, rand), rand() * 0.6, rand() * 360)
      : offsetPoint(origin, 0.2 + rand() ** 1.5 * 9, rand() * 360);
    const category = pick(CATEGORIES, rand);
    const ageHours = rand() ** 2 * 24;

    return {
      id: `demo-${i}`,
      text: TEMPLATES[category][nextTemplate[category]++ % TEMPLATES[category].length],
      category,
      lat: point.lat,
      lng: point.lng,
      createdAt: now - ageHours * 60 * 60 * 1000,
      upvotes: Math.floor(rand() ** 3 * 120),
      author: pick(AUTHORS, rand),
    };
  });
}
