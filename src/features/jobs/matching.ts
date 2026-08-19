import type { Operator } from "@/lib/domain/types";
import type { JobOperatorMatch } from "./queries";

export interface JobCandidate {
  operator: Operator;
  match: JobOperatorMatch | null;
  isAvailable: boolean;
  hasRequiredCapabilities: boolean;
  withinServiceArea: boolean;
  isSuitable: boolean;
}

export function buildJobCandidates(
  jobId: string,
  operators: Operator[],
  matches: JobOperatorMatch[],
): JobCandidate[] {
  return operators
    .filter((operator) => operator.isActive)
    .map((operator): JobCandidate => {
      const match = matches.find((item) => item.jobId === jobId && item.operatorId === operator.id) ?? null;
      const isAvailable = operator.availabilityStatus === "available";
      const hasRequiredCapabilities = match?.hasRequiredCapabilities ?? false;
      const withinServiceArea = match?.withinServiceArea ?? false;

      return {
        operator,
        match,
        isAvailable,
        hasRequiredCapabilities,
        withinServiceArea,
        isSuitable: isAvailable && hasRequiredCapabilities && withinServiceArea,
      };
    })
    .sort((left, right) => {
      const leftScore = Number(left.isSuitable) * 100
        + Number(left.hasRequiredCapabilities) * 16
        + Number(left.withinServiceArea) * 8
        + Number(left.isAvailable) * 4;
      const rightScore = Number(right.isSuitable) * 100
        + Number(right.hasRequiredCapabilities) * 16
        + Number(right.withinServiceArea) * 8
        + Number(right.isAvailable) * 4;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return (left.match?.distanceKm ?? Number.POSITIVE_INFINITY)
        - (right.match?.distanceKm ?? Number.POSITIVE_INFINITY);
    });
}
