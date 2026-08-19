import { describe, expect, it } from "vitest";

import { operatorInputSchema, vehicleInputSchema } from "./schemas";

const validOperator = {
  id: null,
  name: "Norðurhjálp",
  phone: "555 0190",
  companyName: "Norðurhjálp ehf.",
  isActive: true,
  availabilityStatus: "available" as const,
  baseAddress: "Hella, Rangárþing ytra",
  baseLatitude: 65.6839,
  baseLongitude: -18.1105,
  currentLatitude: null,
  currentLongitude: null,
  serviceRadiusKm: 180,
  notes: "",
  capabilities: ["towing", "jump_start"] as const,
};

describe("operatorInputSchema", () => {
  it("accepts multiple capabilities and normalizes empty optional text", () => {
    const result = operatorInputSchema.parse(validOperator);

    expect(result.capabilities).toEqual(["towing", "jump_start"]);
    expect(result.notes).toBeNull();
  });

  it("rejects coordinates outside Iceland's operating bounds", () => {
    const result = operatorInputSchema.safeParse({
      ...validOperator,
      baseLatitude: 40.7128,
      baseLongitude: -74.006,
    });

    expect(result.success).toBe(false);
  });

  it("requires a human-readable base address", () => {
    const result = operatorInputSchema.safeParse({ ...validOperator, baseAddress: "" });

    expect(result.success).toBe(false);
  });

  it("requires at least one operator capability", () => {
    const result = operatorInputSchema.safeParse({ ...validOperator, capabilities: [] });

    expect(result.success).toBe(false);
  });

  it("requires both current-location coordinates together", () => {
    const result = operatorInputSchema.safeParse({
      ...validOperator,
      currentLatitude: 64.1,
      currentLongitude: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("vehicleInputSchema", () => {
  it("rejects a vehicle without capabilities", () => {
    const result = vehicleInputSchema.safeParse({
      id: null,
      operatorId: "10000000-0000-4000-8000-000000000001",
      name: "Pallbíll 1",
      registrationNumber: "AB123",
      vehicleType: "flatbed_truck",
      maxVehicleWeightKg: 3500,
      isActive: true,
      notes: null,
      capabilities: [],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a complete active vehicle and normalizes blank optional fields", () => {
    const result = vehicleInputSchema.parse({
      id: null,
      operatorId: "10000000-0000-4000-8000-000000000001",
      name: "Þjónustubíll",
      registrationNumber: "",
      vehicleType: "service_van",
      maxVehicleWeightKg: null,
      isActive: true,
      notes: " ",
      capabilities: ["jump_start"],
    });

    expect(result.registrationNumber).toBeNull();
    expect(result.notes).toBeNull();
  });

  it.each([0, -1, 100_001])("rejects invalid maximum vehicle weight %s", (weight) => {
    expect(vehicleInputSchema.safeParse({
      id: null,
      operatorId: "10000000-0000-4000-8000-000000000001",
      name: "Þjónustubíll",
      registrationNumber: "AB-123",
      vehicleType: "service_van",
      maxVehicleWeightKg: weight,
      isActive: true,
      notes: null,
      capabilities: ["jump_start"],
    }).success).toBe(false);
  });
});
