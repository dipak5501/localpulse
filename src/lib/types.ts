export interface LatLng {
  lat: number;
  lng: number;
}

export type Category = "event" | "food" | "music" | "sports" | "alert" | "chatter";

export interface Pulse {
  id: string;
  text: string;
  category: Category;
  lat: number;
  lng: number;
  /** Unix epoch milliseconds. */
  createdAt: number;
  upvotes: number;
  author: string;
}

export interface RankedPulse extends Pulse {
  distanceKm: number;
  score: number;
}
