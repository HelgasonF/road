import { describe, expect, it } from "vitest";

import type { Operator } from "@/lib/domain/types";
import type { JobOperatorMatch } from "./queries";
import { buildJobCandidates } from "./matching";

function operator(
  id: string,
  availabilityStatus: Operator["availabilityStatus"] = "available",
  isActive = true,
): Operator {
  return {
    id,
    userId: null,
    driverAccess: null,
    name: `Operator ${id}`,
    phone: "555-0000",
    companyName: null,
    isActive,
    availabilityStatus,
    baseAddress: "Iceland",
    baseLatitude: 64.5,
    baseLongitude: -20,
    currentLatitude: null,
    currentLongitude: null,
    currentLocationUpdatedAt: null,
    serviceRadiusKm: 100,
    notes: null,
    capabilities: [],
    vehicles: [],
    createdAt: "2026-08-19T00:00:00Z",
    updatedAt: "2026-08-19T00:00:00Z",
  };
}

function match(
  operatorId: string,
  options: Partial<JobOperatorMatch> = {},
): JobOperatorMatch {
  return {
    jobId: "job-1",
    operatorId,
    distanceKm: 25,
    hasRequiredCapabilities: true,
    withinServiceArea: true,
    ...options,
  };
}

describe("buildJobCandidates", () => {
  it("marks a provider suitable only when available, capable, and inside the service area", () => {
    const [candidate] = buildJobCandidates("job-1", [operator("one")], [match("one")]);

    expect(candidate.isAvailable).toBe(true);
    expect(candidate.hasRequiredCapabilities).toBe(true);
    expect(candidate.withinServiceArea).toBe(true);
    expect(candidate.isSuitable).toBe(true);
  });

  it("makes providers outside their radius or currently busy unsuitable", () => {
    const candidates = buildJobCandidates(
      "job-1",
      [operator("outside"), operator("busy", "busy")],
      [match("outside", { withinServiceArea: false }), match("busy")],
    );

    expect(candidates.find((candidate) => candidate.operator.id === "outside")?.isSuitable).toBe(false);
    expect(candidates.find((candidate) => candidate.operator.id === "busy")?.isSuitable).toBe(false);
  });

  it("ranks a genuinely suitable provider before a closer incomplete match", () => {
    const candidates = buildJobCandidates(
      "job-1",
      [operator("close"), operator("suitable")],
      [
        match("close", { distanceKm: 5, hasRequiredCapabilities: false }),
        match("suitable", { distanceKm: 40 }),
      ],
    );

    expect(candidates.map((candidate) => candidate.operator.id)).toEqual(["suitable", "close"]);
  });

  it("does not return inactive providers", () => {
    const candidates = buildJobCandidates(
      "job-1",
      [operator("active"), operator("inactive", "available", false)],
      [match("active"), match("inactive")],
    );

    expect(candidates.map((candidate) => candidate.operator.id)).toEqual(["active"]);
  });

  it.each(["busy", "offline", "unavailable"] as const)("does not mark a %s provider suitable", (status) => {
    const [candidate] = buildJobCandidates("job-1", [operator(status, status)], [match(status)]);

    expect(candidate.isAvailable).toBe(false);
    expect(candidate.isSuitable).toBe(false);
  });

  it("puts a provider with no geographic match last", () => {
    const candidates = buildJobCandidates(
      "job-1",
      [operator("matched"), operator("missing")],
      [match("matched", { distanceKm: 500, hasRequiredCapabilities: false })],
    );

    expect(candidates.map((candidate) => candidate.operator.id)).toEqual(["matched", "missing"]);
    expect(candidates[1].match).toBeNull();
    expect(candidates[1].isSuitable).toBe(false);
  });
});
