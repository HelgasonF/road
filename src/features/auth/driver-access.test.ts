import { describe, expect, it } from "vitest";

import { driverAccessTokenSchema } from "./driver-access";

describe("driver access token", () => {
  it("accepts a non-empty Supabase token hash", () => {
    expect(driverAccessTokenSchema.safeParse({ tokenHash: "a".repeat(40), type: "signup" }).success).toBe(true);
    expect(driverAccessTokenSchema.safeParse({ tokenHash: "a".repeat(40), type: "magiclink" }).success).toBe(true);
  });

  it("rejects missing and unreasonably large token values", () => {
    expect(driverAccessTokenSchema.safeParse({ tokenHash: "", type: "signup" }).success).toBe(false);
    expect(driverAccessTokenSchema.safeParse({ tokenHash: "a".repeat(2049), type: "magiclink" }).success).toBe(false);
    expect(driverAccessTokenSchema.safeParse({ tokenHash: "a".repeat(40), type: "recovery" }).success).toBe(false);
  });
});
