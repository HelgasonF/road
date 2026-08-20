import { describe, expect, it } from "vitest";

import { passwordSetupSchema } from "./schemas";

describe("passwordSetupSchema", () => {
  it("accepts a matching password with letters and numbers", () => {
    expect(passwordSetupSchema.safeParse({
      password: "VegstodDriver2026!",
      confirmPassword: "VegstodDriver2026!",
    }).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    expect(passwordSetupSchema.safeParse({
      password: "VegstodDriver2026!",
      confirmPassword: "DifferentDriver2026!",
    }).success).toBe(false);
  });

  it.each(["short1", "onlyletters", "123456789012"])("rejects weak password %s", (password) => {
    expect(passwordSetupSchema.safeParse({ password, confirmPassword: password }).success).toBe(false);
  });
});
