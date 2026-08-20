import { describe, expect, it } from "vitest";

import {
  driverAssignmentResponseSchema,
  driverAvailabilitySchema,
  driverJobStatusSchema,
} from "./schemas";

describe("driver action schemas", () => {
  it("requires a useful reason when an assignment is declined", () => {
    expect(driverAssignmentResponseSchema.safeParse({
      assignmentId: "40000000-0000-4000-8000-000000000001",
      accept: false,
      notes: "",
    }).success).toBe(false);

    expect(driverAssignmentResponseSchema.safeParse({
      assignmentId: "40000000-0000-4000-8000-000000000001",
      accept: false,
      notes: "Of langt frá núverandi staðsetningu",
    }).success).toBe(true);
  });

  it("allows an acceptance without notes", () => {
    expect(driverAssignmentResponseSchema.safeParse({
      assignmentId: "40000000-0000-4000-8000-000000000001",
      accept: true,
      notes: null,
    }).success).toBe(true);
  });

  it("accepts driver availability values and rejects dispatcher-only job statuses", () => {
    expect(driverAvailabilitySchema.safeParse({ status: "available" }).success).toBe(true);
    expect(driverJobStatusSchema.safeParse({
      jobId: "30000000-0000-4000-8000-000000000001",
      status: "en_route",
      notes: null,
    }).success).toBe(true);
    expect(driverJobStatusSchema.safeParse({
      jobId: "30000000-0000-4000-8000-000000000001",
      status: "cancelled",
      notes: null,
    }).success).toBe(false);
  });
});
