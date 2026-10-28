import type { Category } from "./types";

export const CATEGORIES: readonly Category[] = [
  "event",
  "food",
  "music",
  "sports",
  "alert",
  "chatter",
] as const;

/** Harbor chart palette — teal / amber / sea, not purple-AI defaults. */
export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  event: { label: "Events", color: "#0f766e" },
  food: { label: "Food", color: "#c2410c" },
  music: { label: "Music", color: "#b45309" },
  sports: { label: "Sports", color: "#15803d" },
  alert: { label: "Alerts", color: "#b91c1c" },
  chatter: { label: "Chatter", color: "#1d4ed8" },
};
