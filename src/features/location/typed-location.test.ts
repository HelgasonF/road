import { describe, expect, it } from "vitest";
import { automaticLocation, normalizeLocationQuery, resolvedSearchLocation } from "./typed-location";

const keflavik = { id: "osm:node:1", label: "Keflavík · Bær", latitude: 64, longitude: -22.56 };
const address = { id: "hms:2", label: "Hafnargata 12, 230 Keflavík", latitude: 64.001, longitude: -22.55 };

describe("typed location resolution", () => {
  it.each([[" í  Keflavík ", "Keflavík"], ["i Keflavik", "Keflavik"], ["in Keflavik", "Keflavik"], ["á Akureyri", "Akureyri"], ["Ísafjörður", "Ísafjörður"], ["Hafnargata 12", "Hafnargata 12"]])("normalizes %s without altering place names", (value, expected) => {
    expect(normalizeLocationQuery(value)).toBe(expected);
  });

  it("recognizes one exact town even if address suggestions are also present", () => {
    expect(automaticLocation("í Keflavik", [keflavik, address])).toEqual(keflavik);
  });

  it("does not silently choose between two equally named locations", () => {
    expect(automaticLocation("Keflavík", [keflavik, { ...keflavik, id: "osm:node:3", latitude: 65 }])).toBeNull();
  });

  it("accepts an unambiguous address and returns no choice for missing results", () => {
    expect(automaticLocation("Hafnargata 12", [address])).toEqual(address);
    expect(automaticLocation("Missing", [])).toBeNull();
    expect(automaticLocation("Hafnargata", [address, { ...address, id: "hms:4", label: "Hafnargata 14, 230 Keflavík" }])).toBeNull();
  });

  it("marks towns as approximate and keeps exact address coordinates unchanged", () => {
    expect(resolvedSearchLocation(keflavik, "is")).toMatchObject({ source: "search", label: "Keflavík · Bær · Áætluð staðsetning", latitude: 64, longitude: -22.56 });
    expect(resolvedSearchLocation(keflavik, "en").label).toContain("Approximate location");
    expect(resolvedSearchLocation(address, "en")).toMatchObject({ ...address, source: "search" });
  });
});
