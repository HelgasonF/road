import type { CapabilityCode, JobPriority } from "@/lib/domain/types";
import { capabilityLabels, jobPriorityLabels } from "@/lib/i18n/is";

export interface DriverJobContactSummary {
  driverName: string;
  locationLabel: string;
  priority: JobPriority;
  requiredCapabilities: CapabilityCode[];
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function toDriverContactArea(locationLabel: string) {
  const normalized = oneLine(locationLabel);
  const containsCoordinates = /[+-]?\d{2}\.\d{3,}\s*,\s*[+-]?\d{2}\.\d{3,}/.test(normalized);
  if (containsCoordinates || /^(?:gps|map pin|pinni á korti)\b/i.test(normalized)) {
    return "Staðsetning skráð á korti";
  }

  const [primary, ...areaParts] = normalized.split(",").map((part) => part.trim());
  if (areaParts.length === 0) return normalized;

  const streetWithoutHouseNumber = primary.replace(
    /\s+\d+(?:-\d+)?[a-záðéíóúýþæö]*$/iu,
    "",
  ).trim();
  return [streetWithoutHouseNumber || primary, ...areaParts].join(", ");
}

function operationalLines(summary: DriverJobContactSummary) {
  return [
    `Svæði: ${toDriverContactArea(summary.locationLabel)}`,
    `Aðstoð: ${summary.requiredCapabilities.map((capability) => capabilityLabels[capability]).join(", ")}`,
    `Forgangur: ${jobPriorityLabels[summary.priority]}`,
  ];
}

function formatDistanceKm(distanceKm: number) {
  return String(Math.round(distanceKm * 10) / 10).replace(".", ",");
}

export function buildDriverAvailabilityMessage(
  summary: DriverJobContactSummary,
  distanceKm: number | null,
) {
  const distanceLine = distanceKm !== null && Number.isFinite(distanceKm) && distanceKm >= 0
    ? `Áætluð bein fjarlægð: ${formatDistanceKm(distanceKm)} km`
    : null;

  return [
    `Hæ ${oneLine(summary.driverName)}. Ertu laus í verkefni fyrir Vegstoð?`,
    "",
    ...operationalLines(summary),
    distanceLine,
    "",
    "Svaraðu vinsamlega já eða nei.",
  ].filter((line): line is string => line !== null).join("\n");
}

export function buildDriverAssignmentMessage(
  summary: DriverJobContactSummary,
  driverUrl: string,
) {
  return [
    `Hæ ${oneLine(summary.driverName)}. Verkefninu hefur verið úthlutað til þín í Vegstoð.`,
    "",
    ...operationalLines(summary),
    "",
    "Opnaðu örugga tengilinn til að sjá nákvæma staðsetningu og upplýsingar viðskiptavinar:",
    driverUrl.trim(),
    "",
    "Tengillinn rennur út. Ekki framsenda tengilinn.",
  ].join("\n");
}
