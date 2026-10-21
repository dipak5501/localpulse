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

/** Extra copy used when the map is centered on Long Beach, CA. */
const LONG_BEACH_TEMPLATES: Record<Category, string[]> = {
  event: [
    "ArtWalk is hopping on downtown Promenade",
    "Queen Mary lights look incredible tonight",
    "CSULB campus event packing the quad",
  ],
  food: [
    "Belmont Shore brunch line is moving finally",
    "Pike food hall has a new dumpling stall",
    "Retro Row coffee shop doing free refills",
  ],
  music: [
    "Live set at the Aquarium plaza, vibes are good",
    "Downtown LB open mic still has slots",
  ],
  sports: [
    "Pickup soccer at El Dorado Park needs one more",
    "Beach volleyball courts are open by Alamitos",
  ],
  alert: [
    "Shoreline Drive is crawling near the Aquarium",
    "Parking full at Belmont Pier, try 2nd Street",
  ],
  chatter: [
    "Harbor sunset from Rainbow Harbor is unreal",
    "Anyone know what's filming near the Pike?",
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

/** Rough Long Beach / LA harbor coast: prefer bearings that stay inland (N/NE/E/NW). */
export function isCoastalSouthernCalifornia(origin: LatLng): boolean {
  return origin.lat > 33.5 && origin.lat < 34.2 && origin.lng > -118.6 && origin.lng < -117.8;
}

/** Uniform bearing, or a landward bias near the SoCal coast so demo pins don't fill the ocean. */
export function randomBearing(rand: () => number, coastal: boolean): number {
  if (!coastal) return rand() * 360;
  // Prefer 300°–90° (NW → N → E), which keeps most points on land for Long Beach.
  return (300 + rand() * 150) % 360;
}

function templatesFor(origin: LatLng): Record<Category, string[]> {
  if (!isCoastalSouthernCalifornia(origin)) return TEMPLATES;
  return Object.fromEntries(
    CATEGORIES.map((c) => [c, [...TEMPLATES[c], ...LONG_BEACH_TEMPLATES[c]]]),
  ) as Record<Category, string[]>;
}

/**
 * Generates realistic-looking pulses around `origin`. Most cluster around a
 * few hotspots so the map shows meaningful density rather than uniform noise.
 */
export function generateDemoPulses(origin: LatLng, now: number, count = 45): Pulse[] {
  const rand = mulberry32(Math.round(origin.lat * 1000) * 31 + Math.round(origin.lng * 1000));
  const coastal = isCoastalSouthernCalifornia(origin);
  const templates = templatesFor(origin);
  const hotspots = Array.from({ length: 3 }, () =>
    offsetPoint(origin, 0.5 + rand() * 4, randomBearing(rand, coastal)),
  );
  const nextTemplate = Object.fromEntries(
    CATEGORIES.map((c) => [c, Math.floor(rand() * templates[c].length)]),
  ) as Record<Category, number>;

  return Array.from({ length: count }, (_, i) => {
    const nearHotspot = rand() < 0.6;
    const point = nearHotspot
      ? offsetPoint(pick(hotspots, rand), rand() * 0.6, randomBearing(rand, coastal))
      : offsetPoint(origin, 0.2 + rand() ** 1.5 * 9, randomBearing(rand, coastal));
    const category = pick(CATEGORIES, rand);
    const ageHours = rand() ** 2 * 24;

    return {
      id: `demo-${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}-${i}`,
      text: templates[category][nextTemplate[category]++ % templates[category].length],
      category,
      lat: point.lat,
      lng: point.lng,
      createdAt: now - ageHours * 60 * 60 * 1000,
      upvotes: Math.floor(rand() ** 3 * 120),
      author: pick(AUTHORS, rand),
    };
  });
}
