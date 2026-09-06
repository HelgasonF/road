import { describe, expect, it } from "vitest";

import {
  buildDriverAccessPath,
  buildDriverAccessWhatsAppMessage,
  getDriverAuthEmail,
} from "./driver-access";

describe("driver WhatsApp access", () => {
  it("uses a deterministic internal Auth address that is never sent to the driver", () => {
    expect(getDriverAuthEmail("10000000-0000-4000-8000-000000000001"))
      .toBe("driver-10000000-0000-4000-8000-000000000001@access.vegstod.invalid");
  });

  it("builds a first-party one-time access path without exposing an Auth email", () => {
    expect(buildDriverAccessPath("hashed+token/value", "magiclink"))
      .toBe("/driver/access?token_hash=hashed%2Btoken%2Fvalue&type=magiclink");
  });

  it("builds the onboarding message around WhatsApp and the private Vegstoð link", () => {
    const message = buildDriverAccessWhatsAppMessage(
      " Bjarni   Ólafsson ",
      "https://vegstod.is/driver/access?token_hash=secret",
    );

    expect(message).toContain("Hæ Bjarni Ólafsson");
    expect(message).toContain("öruggur aðgangstengill");
    expect(message).toContain("https://vegstod.is/driver/access?token_hash=secret");
    expect(message).toContain("Ekki framsenda tengilinn");
    expect(message).not.toContain("netfang");
  });
});
