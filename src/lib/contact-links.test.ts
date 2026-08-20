import { describe, expect, it } from "vitest";

import { buildContactLinks } from "./contact-links";

describe("buildContactLinks", () => {
  it("adds Iceland's country code to a seven-digit local number", () => {
    expect(buildContactLinks("555-0104")).toEqual({
      callHref: "tel:5550104",
      whatsappHref: "https://wa.me/3545550104",
    });
  });

  it.each([
    ["+354 555 0104", "tel:+3545550104", "https://wa.me/3545550104"],
    ["00354 555 0104", "tel:+3545550104", "https://wa.me/3545550104"],
    ["+44 7700 900123", "tel:+447700900123", "https://wa.me/447700900123"],
  ])("preserves an explicitly international number: %s", (phone, callHref, whatsappHref) => {
    expect(buildContactLinks(phone)).toEqual({ callHref, whatsappHref });
  });

  it("keeps calling available when a short number cannot form a WhatsApp address", () => {
    expect(buildContactLinks("112")).toEqual({
      callHref: "tel:112",
      whatsappHref: null,
    });
  });

  it.each(["", "no phone", "+--"])("rejects a value without a usable phone number: %s", (phone) => {
    expect(buildContactLinks(phone)).toEqual({ callHref: null, whatsappHref: null });
  });

  it("does not create a WhatsApp link longer than the E.164 limit", () => {
    expect(buildContactLinks("+1234567890123456")).toEqual({
      callHref: "tel:+1234567890123456",
      whatsappHref: null,
    });
  });
});
