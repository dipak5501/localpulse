"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const KEY = "localpulse:display-name:v1";

function parseName(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 40) : null;
}

function randomHandle(): string {
  return `pulse${Math.floor(Math.random() * 9000) + 1000}`;
}

/** Stable anonymous display name, persisted so posts keep the same @handle. */
export function useDisplayName(): string {
  const [name, setName] = useLocalStorage<string>(KEY, "", parseName);

  useEffect(() => {
    if (!name) setName(randomHandle());
  }, [name, setName]);

  return name || "you";
}
