import { describe, expect, it } from "vitest";

import { formatContactName, formatPhoneNumber, normalizePhoneNumber, isValidPhoneNumber } from "./phone";

describe("phone normalization", () => {
  it.each([
    ["6597003", "+3546597003"],
    ["659 7003", "+3546597003"],
    ["354 659 7003", "+3546597003"],
    ["00354 659 7003", "+3546597003"],
    ["+1 (702) 219-6679", "+17022196679"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("normalizes %s without changing the destination", (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it("uses the selected country for a national number", () => {
    expect(normalizePhoneNumber("(702) 219-6679", "US")).toBe("+17022196679");
    expect(normalizePhoneNumber("020 7946 0958", "GB")).toBe("+442079460958");
    expect(normalizePhoneNumber("070 123 45 67", "SE")).toBe("+46701234567");
  });

  it.each(["", "112", "no number", "17022196679", "+999123456789", "+1234567890123456", "+3546597003 ext. 12"])(
    "does not reinterpret an unsupported legacy value: %s", (input) => {
      expect(normalizePhoneNumber(input)).toBeNull();
    },
  );
});

describe("readable phone display", () => {
  it.each([
    ["+17022196679", "+1 (702) 219-6679"],
    ["+12025550123", "+1 (202) 555-0123"],
    ["+3546597003", "+354 659 7003"],
    ["555-0104", "+354 555 0104"],
    ["003546597003", "+354 659 7003"],
    ["+442079460958", "+44 20 7946 0958"],
    ["+33612345678", "+33 6 12 34 56 78"],
    ["112", "112"],
    ["unknown", "unknown"],
  ])("displays %s as %s", (input, expected) => {
    expect(formatPhoneNumber(input)).toBe(expected);
  });

  it("is safe for missing optional contact data", () => {
    expect(formatPhoneNumber(null)).toBe("");
    expect(formatPhoneNumber(undefined)).toBe("");
  });

  it("formats a phone placeholder while leaving an actual customer name alone", () => {
    expect(formatContactName("+17022196679", "+17022196679")).toBe("+1 (702) 219-6679");
    expect(formatContactName("Noam", "+17022196679")).toBe("Noam");
  });
});

describe("phone input validation", () => {
  it.each(["6597003", "+17022196679", "+442079460958", "+33612345678"])("accepts %s", (input) => {
    expect(isValidPhoneNumber(input)).toBe(true);
  });

  it.each(["", "123", "+3541111111", "+999123456789", "call 6597003", "+170221966790000"])("rejects %s", (input) => {
    expect(isValidPhoneNumber(input)).toBe(false);
  });
});
