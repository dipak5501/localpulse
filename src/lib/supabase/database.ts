import type { Category } from "@/lib/types";

export interface NearbyPulseRow {
  id: string;
  author_name: string;
  text: string;
  category: Category;
  lat: number;
  lng: number;
  upvotes: number;
  created_at: string;
  distance_km: number;
}

export interface CreatedPulseRow {
  id: string;
  author_name: string;
  text: string;
  category: Category;
  lat: number;
  lng: number;
  upvotes: number;
  created_at: string;
}
