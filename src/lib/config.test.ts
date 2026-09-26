import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabaseAdminConfig, getSupabaseConfig, hasSupabaseConfig } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase configuration", () => {
  it("trims whitespace pasted into environment values", () => {
    // A trailing newline in the key broke Realtime: the key travels in the
    // WebSocket URL, where fetch's header trimming does not apply.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://example.supabase.co\n");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_abc\n");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_xyz\r\n");

    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_abc",
    });
    expect(getSupabaseAdminConfig().secretKey).toBe("sb_secret_xyz");
  });

  it("treats a whitespace-only value as missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "\n");

    expect(hasSupabaseConfig()).toBe(false);
    expect(() => getSupabaseConfig()).toThrow("not configured");
  });
});
