"use client";

import { CATEGORY_META } from "@/lib/categories";
import { formatAge, formatDistance } from "@/lib/format";
import type { RankedPulse } from "@/lib/types";

interface PulseFeedProps {
  pulses: RankedPulse[];
  now: number;
  selectedId: string | null;
  upvoted: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleUpvote: (id: string) => void;
}

export function PulseFeed({ pulses, now, selectedId, upvoted, onSelect, onToggleUpvote }: PulseFeedProps) {
  if (pulses.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
        Nothing trending here yet. Widen the radius or be the first to post.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {pulses.map((pulse, index) => {
        const { color, label } = CATEGORY_META[pulse.category];
        const selected = pulse.id === selectedId;
        const voted = upvoted.has(pulse.id);
        return (
          <li key={pulse.id}>
            <div
              className={`flex gap-3 rounded-xl border p-3 transition ${
                selected ? "border-sky-500/60 bg-sky-500/10" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(pulse.id)}
                className="flex min-w-0 flex-1 gap-3 text-left"
              >
                <span className="w-5 shrink-0 pt-0.5 font-mono text-xs text-zinc-500">{index + 1}</span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm text-zinc-100">{pulse.text}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                    <span>{formatDistance(pulse.distanceKm)}</span>
                    <span>{formatAge(now - pulse.createdAt)}</span>
                    <span>@{pulse.author}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggleUpvote(pulse.id)}
                aria-pressed={voted}
                aria-label={`${voted ? "Remove upvote from" : "Upvote"} "${pulse.text}"`}
                className={`flex shrink-0 flex-col items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                  voted ? "text-sky-400" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M12 4l8 10h-5v6h-6v-6H4z" />
                </svg>
                {pulse.upvotes}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
