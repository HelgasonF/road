import type { CapabilityCode, JobPriority } from "@/lib/domain/types";
import { capabilityLabels, jobPriorityLabels } from "@/lib/i18n/is";
import { describeDriverArea } from "./driver-area";

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


export function buildDriverAvailabilityMessage(summary: DriverJobContactSummary) {

  return [
    `Hæ ${oneLine(summary.driverName)}. Ertu laus í verkefni fyrir Iceland Road Assistance?`,
    "",
    ...operationalLines(summary),
    "",
    "Svaraðu vinsamlega já eða nei.",
  ].join("\n");
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
