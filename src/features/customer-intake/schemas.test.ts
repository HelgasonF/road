import { describe, expect, it } from "vitest";

import {
  customerIntakeSchema,
  customerPhotoPreparationSchema,
  customerTokenSchema,
} from "./schemas";

const token = "a".repeat(43);

describe("customerTokenSchema", () => {
  it("accepts a 32-byte base64url token", () => {
    expect(customerTokenSchema.safeParse(token).success).toBe(true);
  });

  it.each(["", "short", `${"a".repeat(42)}+`, "a".repeat(44)])(
    "rejects an invalid or incorrectly sized token: %s",
    (value) => expect(customerTokenSchema.safeParse(value).success).toBe(false),
  );
});

describe("customerIntakeSchema", () => {
  const valid = {
    token,
    customerName: "Sophie Martin",
    customerPhone: "+33 6 12 34 56 78",
    vehicleRegistration: "AB-123-CD",
    vehicleMake: "Renault",
    vehicleModel: "Captur",
    vehicleType: "Passenger car",
    latitude: 64.255,
    longitude: -21.13,
    locationLabel: "Current GPS location",
    locationSource: "gps",
    customerNotes: "The front-left tyre is flat.",
  };

  it("normalizes optional vehicle fields while preserving international phone numbers", () => {
    const result = customerIntakeSchema.parse({
      ...valid,
      vehicleRegistration: "  ab-123-cd  ",
      vehicleModel: "   ",
    });

    expect(result.vehicleRegistration).toBe("AB-123-CD");
    expect(result.vehicleModel).toBeNull();
    expect(result.customerPhone).toBe(valid.customerPhone);
  });

  it("rejects a location outside the Iceland operating bounds", () => {
    expect(customerIntakeSchema.safeParse({ ...valid, latitude: 51.5072, longitude: -0.1276 }).success)
      .toBe(false);
  });

  it("requires a useful problem description", () => {
    expect(customerIntakeSchema.safeParse({ ...valid, customerNotes: "No" }).success).toBe(false);
  });
});

describe("customerPhotoPreparationSchema", () => {
  it("accepts a supported photo under 10 MiB", () => {
    expect(customerPhotoPreparationSchema.safeParse({
      token,
      fileName: "vehicle.jpg",
      contentType: "image/jpeg",
      sizeBytes: 2_000_000,
    }).success).toBe(true);
  });

  it("rejects unsupported files and oversized photos", () => {
    expect(customerPhotoPreparationSchema.safeParse({
      token,
      fileName: "document.pdf",
      contentType: "application/pdf",
      sizeBytes: 1_000,
    }).success).toBe(false);
    expect(customerPhotoPreparationSchema.safeParse({
      token,
      fileName: "huge.jpg",
      contentType: "image/jpeg",
      sizeBytes: 10 * 1024 * 1024 + 1,
    }).success).toBe(false);
  });
});
