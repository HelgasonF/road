import { describe, expect, it } from "vitest";

import { buildSmsHref } from "./sms-links";

describe("manual SMS links", () => {
  it.each([
    ["+44 20 7946 0958", "+442079460958"],
    ["0044 20 7946 0958", "+442079460958"],
    ["659 7003", "+3546597003"],
  ])("normalizes the single recipient %s and preserves the complete message", (phone, expected) => {
    const message = "Hæ!\nhttps://vegstod.vercel.app/customer/Ab_12-XY?lang=is&source=sms\nA & B + 10%";
    const href = new URL(buildSmsHref(phone, message)!);
    expect(href.protocol).toBe("sms:");
    expect(href.pathname).toBe(expected);
    expect(href.searchParams.get("body")).toBe(message);
    expect([...href.searchParams.keys()]).toEqual(["body"]);
  });

  it("uses the iOS body separator without changing the recipient or message", () => {
    const message = "Hello,\nhttps://vegstod.vercel.app/customer/private-link";
    const href = buildSmsHref("+442079460958", message, "ios");
    expect(href).toBe(`sms:+442079460958&body=${encodeURIComponent(message)}`);
  });

  it.each(["", "invalid", "112", "91234567", "+1234567890123456", "+442079460958, +3546597003", "+442079460958?body=bad"])("does not create an ambiguous or malformed recipient: %s", (phone) => {
    expect(buildSmsHref(phone, "Hello")).toBeNull();
  });

  it("handles an empty draft without adding a body parameter", () => {
    expect(buildSmsHref("+442079460958", " ")).toBe("sms:+442079460958");
  });
});
