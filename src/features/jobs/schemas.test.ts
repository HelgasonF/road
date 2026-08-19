import { describe, expect, it } from "vitest";

import { assignmentInputSchema, jobInputSchema, jobStatusInputSchema } from "./schemas";

const validJob = {
  id: null,
  customerName: "Sigríður Jónsdóttir",
  customerPhone: "555 0123",
  vehicleRegistration: "AB-123",
  vehicleMake: "Toyota",
  vehicleModel: "RAV4",
  vehicleType: "Fólksbíll",
  latitude: 64.1265,
  longitude: -21.8174,
  locationLabel: "Bústaðavegur 151, Reykjavík",
  locationSource: "search" as const,
  priority: "normal" as const,
  notes: "Sprungið dekk",
  requiredCapabilities: ["tire_assistance"] as const,
};

describe("jobInputSchema", () => {
  it("accepts an address-backed job with multiple capabilities", () => {
    const result = jobInputSchema.parse({
      ...validJob,
      requiredCapabilities: ["tire_assistance", "towing"],
    });

    expect(result.locationLabel).toBe("Bústaðavegur 151, Reykjavík");
    expect(result.requiredCapabilities).toEqual(["tire_assistance", "towing"]);
  });

  it("rejects a job without a verified Iceland location", () => {
    const result = jobInputSchema.safeParse({
      ...validJob,
      latitude: 40.7128,
      longitude: -74.006,
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one assistance capability", () => {
    const result = jobInputSchema.safeParse({ ...validJob, requiredCapabilities: [] });

    expect(result.success).toBe(false);
  });

  it("normalizes blank optional vehicle fields and notes", () => {
    const result = jobInputSchema.parse({
      ...validJob,
      vehicleRegistration: "  ",
      vehicleMake: "",
      vehicleModel: " ",
      vehicleType: "",
      notes: "",
    });

    expect(result.vehicleRegistration).toBeNull();
    expect(result.vehicleMake).toBeNull();
    expect(result.vehicleModel).toBeNull();
    expect(result.vehicleType).toBeNull();
    expect(result.notes).toBeNull();
  });

  it.each([
    ["customerName", "A"],
    ["customerPhone", "1"],
    ["locationLabel", ""],
    ["locationSource", "unknown"],
    ["priority", "critical"],
  ])("rejects invalid %s input", (field, value) => {
    expect(jobInputSchema.safeParse({ ...validJob, [field]: value }).success).toBe(false);
  });
});

describe("job assignment and status schemas", () => {
  it("accepts nullable assignment fields and normalizes blank notes", () => {
    const result = assignmentInputSchema.parse({
      jobId: "10000000-0000-4000-8000-000000000001",
      operatorId: "10000000-0000-4000-8000-000000000002",
      vehicleId: null,
      notes: "",
    });

    expect(result.notes).toBeNull();
  });

  it("rejects malformed assignment identifiers", () => {
    expect(assignmentInputSchema.safeParse({
      jobId: "job-1",
      operatorId: "operator-1",
      vehicleId: null,
      notes: null,
    }).success).toBe(false);
  });

  it("accepts every supported status and rejects unsupported values", () => {
    expect(jobStatusInputSchema.safeParse({
      jobId: "10000000-0000-4000-8000-000000000001",
      status: "transporting",
      notes: null,
    }).success).toBe(true);
    expect(jobStatusInputSchema.safeParse({
      jobId: "10000000-0000-4000-8000-000000000001",
      status: "deleted",
      notes: null,
    }).success).toBe(false);
  });
});
