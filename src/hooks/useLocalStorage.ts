"use client";

import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
/** Used when localStorage throws (e.g. Safari private mode or a full quota) so the session still works. */
const memory = new Map<string, string>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function getRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function setRaw(key: string, raw: string) {
  try {
    window.localStorage.setItem(key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw);
  }
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function read<T>(key: string, fallback: T, parse: (raw: unknown) => T | null): T {
  const raw = getRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;

  let value = fallback;
  if (raw !== null) {
    try {
      value = parse(JSON.parse(raw)) ?? fallback;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

/**
 * `useState` backed by localStorage. Renders `fallback` on the server and during
 * hydration, then the stored value; stays in sync across tabs.
 *
 * `fallback` and `parse` must be referentially stable (e.g. module-level constants).
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | null,
): [T, (update: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (listener: Listener) => {
      const keyListeners = listeners.get(key) ?? new Set();
      keyListeners.add(listener);
      listeners.set(key, keyListeners);

      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);

      return () => {
        keyListeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback, parse),
    () => fallback,
  );

  const setValue = useCallback(
    (update: T | ((prev: T) => T)) => {
      const prev = read(key, fallback, parse);
      const next = typeof update === "function" ? (update as (prev: T) => T)(prev) : update;
      setRaw(key, JSON.stringify(next));
      notify(key);
    },
    [key, fallback, parse],
  );

  return [value, setValue];
}
