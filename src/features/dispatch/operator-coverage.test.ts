import { describe, expect, it } from "vitest";

import type { Operator } from "@/lib/domain/types";
import { createOperatorCoverageGeoJson, getCoverageDiameterPixels } from "./operator-coverage";

function operator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: "operator-1",
    driverAccess: null,
    name: "Prófunaraðili",
    phone: "+3545550000",
    companyName: null,
    isActive: true,
    availabilityStatus: "available",
    baseAddress: "Hella",
    baseLatitude: 63.8355,
    baseLongitude: -20.3987,
    currentLatitude: null,
    currentLongitude: null,
    currentLocationUpdatedAt: null,
    serviceRadiusKm: 80,
    notes: null,
    capabilities: ["towing"],
    vehicles: [],
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
    ...overrides,
    userId: overrides.userId ?? null,
  };
}

describe("createOperatorCoverageGeoJson", () => {
  it("creates a closed geographic polygon around the driver's current location", () => {
    const result = createOperatorCoverageGeoJson([
      operator({ currentLatitude: 64, currentLongitude: -19 }),
    ], "operator-1");

    expect(result.features).toHaveLength(1);
    const feature = result.features[0];
    expect(feature.properties).toMatchObject({
      operatorId: "operator-1",
      radiusKm: 80,
      availabilityStatus: "available",
      selected: true,
    });
    expect(feature.geometry.coordinates[0]).toHaveLength(65);
    expect(feature.geometry.coordinates[0][0]).toEqual(
      feature.geometry.coordinates[0][64],
    );

    const latitudes = feature.geometry.coordinates[0].map((coordinate) => coordinate[1]);
    expect(Math.max(...latitudes)).toBeCloseTo(64 + 80 / 111.2, 2);
  });

  it("uses the base location and omits drivers without a valid radius", () => {
    const result = createOperatorCoverageGeoJson([
      operator(),
      operator({ id: "no-radius", serviceRadiusKm: null }),
      operator({ id: "inactive", isActive: false }),
    ], null);

    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates[0][0][0]).toBeCloseTo(-20.3987, 4);
    expect(result.features[0].properties.selected).toBe(false);
  });
});

describe("getCoverageDiameterPixels", () => {
  it("scales a kilometre radius for the map zoom and Icelandic latitude", () => {
    expect(getCoverageDiameterPixels(80, 64, 7)).toBeCloseTo(298.3, 0);
    expect(getCoverageDiameterPixels(80, 64, 8)).toBeCloseTo(596.6, 0);
  });
});
