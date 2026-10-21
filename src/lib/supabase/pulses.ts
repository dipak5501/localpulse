import type { Category, LatLng, Pulse } from "@/lib/types";
import { getSupabase } from "./client";
import type { CreatedPulseRow, NearbyPulseRow } from "./database";

function rowToPulse(row: NearbyPulseRow | CreatedPulseRow): Pulse {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    lat: Number(row.lat),
    lng: Number(row.lng),
    createdAt: new Date(row.created_at).getTime(),
    upvotes: Number(row.upvotes),
    author: row.author_name,
  };
}

export async function ensureAnonymousSession(): Promise<{ userId: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return { userId: existing.session.user.id };

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("Anonymous sign-in failed:", error?.message);
    return null;
  }
  return { userId: data.user.id };
}

export async function fetchNearbyPulses(origin: LatLng, radiusKm: number): Promise<Pulse[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("nearby_pulses", {
    origin_lat: origin.lat,
    origin_lng: origin.lng,
    radius_km: radiusKm,
    max_age_hours: 48,
    max_results: 300,
  });

  if (error) {
    console.error("nearby_pulses failed:", error.message);
    return [];
  }
  return ((data ?? []) as NearbyPulseRow[]).map(rowToPulse);
}

export async function createPulse(input: {
  text: string;
  category: Category;
  origin: LatLng;
  displayName: string;
}): Promise<Pulse | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("create_pulse", {
    pulse_text: input.text,
    pulse_category: input.category,
    origin_lat: input.origin.lat,
    origin_lng: input.origin.lng,
    display_name: input.displayName,
  });

  if (error) {
    console.error("create_pulse failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as CreatedPulseRow[];
  return rows[0] ? rowToPulse(rows[0]) : null;
}

export async function deletePulse(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("pulses").delete().eq("id", id);
  if (error) {
    console.error("deletePulse failed:", error.message);
    return false;
  }
  return true;
}

export async function setVote(pulseId: string, voted: boolean): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  if (voted) {
    const { error } = await supabase.from("pulse_votes").insert({ pulse_id: pulseId });
    if (error && error.code !== "23505") {
      console.error("vote failed:", error.message);
      return false;
    }
    return true;
  }

  const { error } = await supabase.from("pulse_votes").delete().eq("pulse_id", pulseId);
  if (error) {
    console.error("unvote failed:", error.message);
    return false;
  }
  return true;
}

export async function fetchMyVotes(): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase.from("pulse_votes").select("pulse_id").eq("voter_id", userId);
  if (error) {
    console.error("fetchMyVotes failed:", error.message);
    return [];
  }
  return ((data ?? []) as { pulse_id: string }[]).map((row) => row.pulse_id);
}

export async function fetchMyPulseIds(): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase.from("pulses").select("id").eq("author_id", userId);
  if (error) {
    console.error("fetchMyPulseIds failed:", error.message);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

/** Subscribe to pulse inserts/updates; returns an unsubscribe function. */
export function subscribeToPulses(onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("pulses-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "pulses" }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
