import { describe, expect, it } from "vitest";

import {
  buildDriverTemplateBodyParameters,
  decodeDriverAccessButtonCode,
  encodeDriverAccessButtonCode,
  formatDriverTemplateDistance,
} from "./messages";

describe("WhatsApp operational template values", () => {
  it("builds Icelandic driver parameters without exposing a house number", () => {
    expect(buildDriverTemplateBodyParameters({
      driverName: "  Jón   Einarsson ",
      locationLabel: "Suðurlandsvegur 12, Hvolsvöllur, Ísland",
      priority: "urgent",
      requiredCapabilities: ["towing", "tire_assistance"],
    })).toEqual([
      "Jón Einarsson",
      "Suðurlandsvegur, Hvolsvöllur, Ísland",
      "Dráttur, Dekkjaskipti",
      "Brýnt",
    ]);
  });

  it("formats the distance parameter", () => {
    expect(formatDriverTemplateDistance(12.26)).toBe("12.3 km");
    expect(formatDriverTemplateDistance(null)).toBe("Ekki reiknað");
  });

  it("round trips the private driver token through a URL-safe button code", () => {
    const code = encodeDriverAccessButtonCode(
      "/driver/access?token_hash=hashed%2Btoken%2Fvalue&type=magiclink",
    );
    expect(code).toMatch(/^magiclink\.[A-Za-z0-9_-]+$/);
    expect(decodeDriverAccessButtonCode(code ?? undefined)).toEqual({
      tokenHash: "hashed+token/value",
      type: "magiclink",
    });
    expect(decodeDriverAccessButtonCode("invalid")).toBeNull();
  });
});
