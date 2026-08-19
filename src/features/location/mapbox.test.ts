import { describe, expect, it } from "vitest";

import { toIcelandLocationSuggestion, type MapboxFeature } from "./mapbox";

const invalidFeatures: MapboxFeature[] = [
  { properties: { full_address: "Missing id" } },
  { id: "missing-location", properties: { full_address: "Missing coordinates" } },
  { id: "outside", geometry: { coordinates: [-74.006, 40.7128] }, properties: { full_address: "New York" } },
];

describe("toIcelandLocationSuggestion", () => {
  it("maps a full Mapbox address and property coordinates", () => {
    expect(toIcelandLocationSuggestion({
      id: "address.1",
      geometry: { coordinates: [-20, 64] },
      properties: {
        coordinates: { longitude: -21.9144, latitude: 64.5428 },
        full_address: "Borgarbraut 55, 310 Borgarnes, Ísland",
      },
    })).toEqual({
      id: "address.1",
      label: "Borgarbraut 55, 310 Borgarnes, Ísland",
      latitude: 64.5428,
      longitude: -21.9144,
    });
  });

  it("falls back to geometry coordinates and a composed place label", () => {
    expect(toIcelandLocationSuggestion({
      id: "place.1",
      geometry: { coordinates: [-14.3948, 65.2632] },
      properties: { name_preferred: "Egilsstaðir", place_formatted: "Múlaþing, Ísland" },
    })).toMatchObject({
      label: "Egilsstaðir, Múlaþing, Ísland",
      latitude: 65.2632,
      longitude: -14.3948,
    });
  });

  it.each(invalidFeatures)("rejects incomplete or non-Icelandic results", (feature) => {
    expect(toIcelandLocationSuggestion(feature)).toBeNull();
  });
});
