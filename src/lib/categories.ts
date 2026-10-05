import type { Category } from "./types";

export const CATEGORIES: readonly Category[] = [
  "event",
  "food",
  "music",
  "sports",
  "alert",
  "chatter",
] as const;

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  event: { label: "Events", color: "#a855f7" },
  food: { label: "Food", color: "#f97316" },
  music: { label: "Music", color: "#ec4899" },
  sports: { label: "Sports", color: "#22c55e" },
  alert: { label: "Alerts", color: "#ef4444" },
  chatter: { label: "Chatter", color: "#38bdf8" },
};
