import type { CapabilityCode, JobPriority } from "@/lib/domain/types";
import { capabilityLabels, jobPriorityLabels } from "@/lib/i18n/is";
import { compassDirection, describeDriverArea, type GeoPoint } from "./driver-area";

export interface DriverJobContactSummary {
  driverName: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  priority: JobPriority;
  requiredCapabilities: CapabilityCode[];
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function operationalLines(summary: DriverJobContactSummary) {
  return [
    `Svæði: ${describeDriverArea(summary)}`,
    `Aðstoð: ${summary.requiredCapabilities.map((capability) => capabilityLabels[capability]).join(", ")}`,
    `Forgangur: ${jobPriorityLabels[summary.priority]}`,
  ];
}


/** Where the match distance was measured from: the driver's live position or their base. */
export interface DriverOrigin extends GeoPoint {
  source: "current" | "base";
}

interface OperatorPosition {
  baseLatitude: number;
  baseLongitude: number;
  currentLatitude: number | null;
  currentLongitude: number | null;
}

/** Mirrors the matching query: `coalesce(current_location, base_location)`. */
export function driverOrigin(operator: OperatorPosition): DriverOrigin {
  if (operator.currentLatitude !== null && operator.currentLongitude !== null) {
    return { latitude: operator.currentLatitude, longitude: operator.currentLongitude, source: "current" };
  }
  return { latitude: operator.baseLatitude, longitude: operator.baseLongitude, source: "base" };
}

const originPhrases: Record<DriverOrigin["source"], string> = {
  current: "frá núverandi staðsetningu þinni",
  base: "frá bækistöð þinni",
};

function distanceLine(summary: DriverJobContactSummary, distanceKm: number | null, origin?: DriverOrigin) {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  // Whole kilometres: together with the direction, decimals would narrow down
  // a spot the driver should only learn after accepting the job.
  const base = `Áætluð bein fjarlægð: um ${Math.max(1, Math.round(distanceKm))} km`;
  const points = origin ? [origin.latitude, origin.longitude, summary.latitude, summary.longitude] : [];
  if (!origin || !points.every(Number.isFinite)) return base;
  return `${base} ${compassDirection(origin, summary)} ${originPhrases[origin.source]}`;
}

export function buildDriverAvailabilityMessage(
  summary: DriverJobContactSummary,
  distanceKm: number | null,
  origin?: DriverOrigin,
) {

  return [
    `Hæ ${oneLine(summary.driverName)}. Ertu laus í verkefni fyrir Iceland Road Assistance?`,
    "",
    ...operationalLines(summary),
    distanceLine(summary, distanceKm, origin),
    "",
    "Svaraðu vinsamlega já eða nei.",
  ].filter((line): line is string => line !== null).join("\n");
}

export function buildDriverAssignmentMessage(
  summary: DriverJobContactSummary,
  driverUrl: string,
) {
  return [
    `Hæ ${oneLine(summary.driverName)}. Verkefninu hefur verið úthlutað til þín í Iceland Road Assistance.`,
    "",
    ...operationalLines(summary),
    "",
    "Opnaðu örugga tengilinn til að sjá nákvæma staðsetningu og upplýsingar viðskiptavinar:",
    driverUrl.trim(),
    "",
    "Tengillinn rennur út. Ekki framsenda tengilinn.",
  ].join("\n");
}
