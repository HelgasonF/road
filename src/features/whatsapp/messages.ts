import { toDriverContactArea } from "@/features/jobs/driver-contact";
import type { CapabilityCode, JobPriority } from "@/lib/domain/types";
import { capabilityLabels, jobPriorityLabels } from "@/lib/i18n/is";

export interface DriverTemplateSummary {
  driverName: string;
  locationLabel: string;
  priority: JobPriority;
  requiredCapabilities: CapabilityCode[];
}

export function buildDriverTemplateBodyParameters(summary: DriverTemplateSummary) {
  return [
    summary.driverName.replace(/\s+/g, " ").trim(),
    toDriverContactArea(summary.locationLabel),
    summary.requiredCapabilities.map((code) => capabilityLabels[code]).join(", "),
    jobPriorityLabels[summary.priority],
  ];
}

export function formatDriverTemplateDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return "Ekki reiknað";
  }
  return `${Math.round(distanceKm * 10) / 10} km`;
}

export function encodeDriverAccessButtonCode(path: string) {
  const url = new URL(path, "https://vegstod.vercel.app");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!tokenHash || (type !== "signup" && type !== "magiclink")) return null;

  const encodedToken = Buffer.from(tokenHash, "utf8").toString("base64url");
  return `${type}.${encodedToken}`;
}

export function decodeDriverAccessButtonCode(code: string | undefined) {
  if (!code || code.length > 2_000) return null;
  const separator = code.indexOf(".");
  if (separator < 1) return null;

  const type = code.slice(0, separator);
  const encodedToken = code.slice(separator + 1);
  if (
    (type !== "signup" && type !== "magiclink")
    || !/^[A-Za-z0-9_-]+$/.test(encodedToken)
  ) return null;

  try {
    const tokenHash = Buffer.from(encodedToken, "base64url").toString("utf8");
    if (!tokenHash || tokenHash.length > 2_000) return null;
    return { tokenHash, type } as const;
  } catch {
    return null;
  }
}
