import { describe, expect, it } from "vitest";

import { toLocationSuggestion, toMapPinAddress } from "./hms";

describe("toLocationSuggestion", () => {
  it("maps a valid HMS address result", () => {
    expect(toLocationSuggestion({
      id: "hms:10001414",
      label: "Bæjarlind 8, 201",
      latitude: 64.09987002,
      longitude: -21.87914013,
    })).toEqual({
      id: "hms:10001414",
      label: "Bæjarlind 8, 201",
      latitude: 64.09987002,
      longitude: -21.87914013,
    });
  });

  it("rejects missing labels and coordinates outside Iceland", () => {
    expect(toLocationSuggestion({
      id: "hms:bad",
      label: "",
      latitude: 64.1,
      longitude: -21.9,
    })).toBeNull();
    expect(toLocationSuggestion({
      id: "hms:ocean",
      label: "Rangur punktur",
      latitude: 61,
      longitude: -30,
    })).toBeNull();
  });
});

describe("toMapPinAddress", () => {
  it("maps a valid nearest-address result", () => {
    expect(toMapPinAddress({
      id: "hms:10001414",
      label: "Bæjarlind 8, 201",
      latitude: 64.09987002,
      longitude: -21.87914013,
      distance_meters: 7.4,
    })).toEqual({
      label: "Bæjarlind 8, 201",
      distanceMeters: 7.4,
    });
  });

  it("rejects invalid labels and distances", () => {
    expect(toMapPinAddress({
      id: "hms:bad",
      label: "",
      latitude: 64.1,
      longitude: -21.9,
      distance_meters: 1,
    })).toBeNull();
    expect(toMapPinAddress({
      id: "hms:bad-distance",
      label: "Bæjarlind 8, 201",
      latitude: 64.1,
      longitude: -21.9,
      distance_meters: -1,
    })).toBeNull();
  });
});
