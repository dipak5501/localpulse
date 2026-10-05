"use client";

import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/lib/types";

interface FiltersProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  activeCategories: ReadonlySet<Category>;
  onToggleCategory: (category: Category) => void;
}

export function Filters({ radiusKm, onRadiusChange, activeCategories, onToggleCategory }: FiltersProps) {
  return (
    <section className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <label htmlFor="radius" className="font-medium text-zinc-300">
            Search radius
          </label>
          <span className="font-mono text-sky-400">{radiusKm} km</span>
        </div>
        <input
          id="radius"
          type="range"
          min={1}
          max={15}
          step={1}
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full accent-sky-400"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {CATEGORIES.map((category) => {
          const { label, color } = CATEGORY_META[category];
          const active = activeCategories.has(category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleCategory(category)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                  : "border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color, opacity: active ? 1 : 0.35 }}
              />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
