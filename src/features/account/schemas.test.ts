import { describe, expect, it } from "vitest";

import { changePasswordSchema, newStaffUserSchema, staffPasswordSchema } from "./schemas";

describe("staffPasswordSchema", () => {
  it.each(["alli2026ira", "Vegstod2026"])("accepts a simple password with letters and digits: %s", (password) => {
    expect(staffPasswordSchema.safeParse(password).success).toBe(true);
  });

  it.each([
    ["too short", "abc12345"],
    ["no digits", "onlyletters"],
    ["no letters", "1234567890"],
  ])("rejects a password that is %s", (_reason, password) => {
    expect(staffPasswordSchema.safeParse(password).success).toBe(false);
  });
});

describe("newStaffUserSchema", () => {
  it("normalises the email and trims the name", () => {
    expect(newStaffUserSchema.parse({
      displayName: "  Daldís ",
      email: " Daldis@Example.IS ",
      password: "daldis2026ira",
      role: "dispatcher",
    })).toEqual({ displayName: "Daldís", email: "daldis@example.is", password: "daldis2026ira", role: "dispatcher" });
  });

  it.each(["driver", "pending", "owner"])("only allows staff roles, not %s", (role) => {
    expect(newStaffUserSchema.safeParse({
      displayName: "Test", email: "test@example.is", password: "test2026ira", role,
    }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "old2026pass", newPassword: "new2026pass", confirmPassword: "new2026pass" };

  it("accepts a matching new password", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a confirmation that does not match", () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: "new2026pasx" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.confirmPassword).toBeDefined();
  });

  it("rejects reusing the current password", () => {
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: "old2026pass", confirmPassword: "old2026pass" }).success)
      .toBe(false);
  });
});
