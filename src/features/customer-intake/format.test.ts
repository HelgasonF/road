import { describe, expect, it } from "vitest";

import { formatCustomerLinkExpiry } from "./format";

describe("formatCustomerLinkExpiry", () => {
  it("formats the Iceland UTC time without depending on the server or browser locale", () => {
    const expiry = "2026-09-08T22:02:46.394Z";

    expect(formatCustomerLinkExpiry(expiry, "en")).toBe("08 Sep 2026, 22:02");
    expect(formatCustomerLinkExpiry(expiry, "is")).toBe("08.09.2026 kl. 22:02");
  });
});
