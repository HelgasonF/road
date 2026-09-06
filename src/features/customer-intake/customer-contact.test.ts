import { describe, expect, it } from "vitest";

import { buildCustomerIntakeWhatsAppMessage } from "./customer-contact";

describe("customer intake WhatsApp message", () => {
  it("includes the customer, secure form link, English instructions, and privacy warning", () => {
    const message = buildCustomerIntakeWhatsAppMessage(
      "  Sophie   Martin ",
      "https://dispatch.vegstod.is/customer/secure-token",
    );

    expect(message).toContain("Sophie Martin");
    expect(message).toContain("https://dispatch.vegstod.is/customer/secure-token");
    expect(message).toContain("Please confirm your location");
    expect(message).toContain("Do not forward it");
    expect(message).not.toContain("Staðfestu staðsetningu");
    expect(message).not.toContain("gildir í 24 klukkustundir");
  });
});
