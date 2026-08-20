import { describe, expect, it } from "vitest";

import { createCustomerIntakeToken, hashCustomerIntakeToken } from "./tokens";

describe("customer intake tokens", () => {
  it("creates URL-safe tokens with 256 bits of entropy", () => {
    const first = createCustomerIntakeToken();
    const second = createCustomerIntakeToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes tokens deterministically without storing the raw token", () => {
    expect(hashCustomerIntakeToken("test-token"))
      .toBe("4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e");
  });
});
