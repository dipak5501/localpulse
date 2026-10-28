"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/lib/types";

export const MAX_PULSE_LENGTH = 280;

interface PostPulseFormProps {
  onPost: (text: string, category: Category) => void | Promise<void>;
}

export function PostPulseForm({ onPost }: PostPulseFormProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("chatter");
  const trimmed = text.trim();

  return (
    <form
      className="space-y-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        onPost(trimmed, category);
        setText("");
      }}
    >
      <label htmlFor="pulse-text" className="sr-only">
        What&apos;s happening near you?
      </label>
      <textarea
        id="pulse-text"
        value={text}
        maxLength={MAX_PULSE_LENGTH}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening on this block?"
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-[color:var(--ink)] placeholder:text-[color:var(--muted)] focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <label htmlFor="pulse-category" className="sr-only">
          Category
        </label>
        <select
          id="pulse-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-md border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-2 py-1 text-xs text-[color:var(--ink)]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-xs text-[color:var(--muted)]">
          {text.length}/{MAX_PULSE_LENGTH}
        </span>
        <button
          type="submit"
          disabled={!trimmed}
          className="rounded-md bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Pulse it
        </button>
      </div>
    </form>
  );
}
