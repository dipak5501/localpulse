"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  createPulse,
  deletePulse,
  ensureAnonymousSession,
  fetchMyPulseIds,
  fetchMyVotes,
  fetchNearbyPulses,
  setVote,
  subscribeToPulses,
} from "@/lib/supabase/pulses";
import type { Category, LatLng, Pulse } from "@/lib/types";

export type RemoteStatus = "offline" | "connecting" | "live" | "error";

interface UseRemotePulsesResult {
  enabled: boolean;
  status: RemoteStatus;
  pulses: Pulse[];
  upvoted: ReadonlySet<string>;
  ownIds: ReadonlySet<string>;
  userId: string | null;
  refresh: () => void;
  post: (text: string, category: Category, origin: LatLng, displayName: string) => Promise<Pulse | null>;
  toggleUpvote: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Live pulses from Supabase when configured; otherwise a no-op so the app
 * keeps using local demo data.
 */
export function useRemotePulses(origin: LatLng | null, radiusKm: number): UseRemotePulsesResult {
  const enabled = isSupabaseConfigured();
  const [status, setStatus] = useState<RemoteStatus>(enabled ? "connecting" : "offline");
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [upvoted, setUpvoted] = useState<ReadonlySet<string>>(() => new Set());
  const [ownIds, setOwnIds] = useState<ReadonlySet<string>>(() => new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const originLat = origin?.lat;
  const originLng = origin?.lng;

  useEffect(() => {
    if (!enabled || originLat === undefined || originLng === undefined) return;

    let cancelled = false;
    const point = { lat: originLat, lng: originLng };

    (async () => {
      setStatus("connecting");
      const session = await ensureAnonymousSession();
      if (cancelled) return;
      if (!session) {
        setStatus("error");
        return;
      }
      setUserId(session.userId);

      const [nearby, votes, mine] = await Promise.all([
        fetchNearbyPulses(point, radiusKm),
        fetchMyVotes(),
        fetchMyPulseIds(),
      ]);
      if (cancelled) return;

      setPulses(nearby);
      setUpvoted(new Set(votes));
      setOwnIds(new Set(mine));
      setStatus("live");
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, originLat, originLng, radiusKm, tick]);

  useEffect(() => {
    if (!enabled || status !== "live") return;
    return subscribeToPulses(refresh);
  }, [enabled, status, refresh]);

  const post = useCallback(
    async (text: string, category: Category, pos: LatLng, displayName: string) => {
      const created = await createPulse({ text, category, origin: pos, displayName });
      if (created) {
        setPulses((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        setOwnIds((prev) => new Set(prev).add(created.id));
      }
      return created;
    },
    [],
  );

  const toggleUpvote = useCallback(async (id: string) => {
    setUpvoted((prev) => {
      const next = new Set(prev);
      const voting = !next.has(id);
      if (voting) next.add(id);
      else next.delete(id);
      void setVote(id, voting);
      setPulses((pulsesPrev) =>
        pulsesPrev.map((p) =>
          p.id === id ? { ...p, upvotes: Math.max(0, p.upvotes + (voting ? 1 : -1)) } : p,
        ),
      );
      return next;
    });
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deletePulse(id);
    if (!ok) return;
    setPulses((prev) => prev.filter((p) => p.id !== id));
    setOwnIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setUpvoted((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    enabled,
    status: enabled ? status : "offline",
    pulses,
    upvoted,
    ownIds,
    userId,
    refresh,
    post,
    toggleUpvote,
    remove,
  };
}
