import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";

describe("supabase config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports offline when env vars are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseConfig()).toBeNull();
  });

  it("returns trimmed credentials when both are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://example.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key ");
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });
});
