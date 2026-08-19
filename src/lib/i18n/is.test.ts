import { describe, expect, it } from "vitest";

import {
  availabilityStatuses,
  capabilityCodes,
  jobPriorities,
  jobStatuses,
  locationSources,
  vehicleTypes,
} from "@/lib/domain/types";
import {
  availabilityLabels,
  capabilityLabels,
  jobPriorityLabels,
  jobStatusLabels,
  locationSourceLabels,
  vehicleTypeLabels,
} from "./is";

describe("Icelandic enum labels", () => {
  it.each([
    [capabilityCodes, capabilityLabels],
    [availabilityStatuses, availabilityLabels],
    [vehicleTypes, vehicleTypeLabels],
    [jobStatuses, jobStatusLabels],
    [jobPriorities, jobPriorityLabels],
    [locationSources, locationSourceLabels],
  ])("has exactly one non-English display label for each internal code", (codes, labels) => {
    expect(Object.keys(labels).sort()).toEqual([...codes].sort());
    expect(Object.values(labels).every((label) => label.length > 1)).toBe(true);
  });
});
