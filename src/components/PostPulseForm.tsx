"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/lib/types";

export const MAX_PULSE_LENGTH = 280;

interface PostPulseFormProps {
  onPost: (text: string, category: Category) => void;
}

export function PostPulseForm({ onPost }: PostPulseFormProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("chatter");
  const trimmed = text.trim();

  return (
    <form
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
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
        placeholder="What's happening near you?"
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <label htmlFor="pulse-category" className="sr-only">
          Category
        </label>
        <select
          id="pulse-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-xs text-zinc-500">
          {text.length}/{MAX_PULSE_LENGTH}
        </span>
        <button
          type="submit"
          disabled={!trimmed}
          className="rounded-md bg-sky-500 px-3 py-1 text-xs font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Pulse it
        </button>
      </div>
    </form>
  );
}
