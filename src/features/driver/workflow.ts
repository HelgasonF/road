import type { JobStatus } from "@/lib/domain/types";

export interface DriverStatusAction {
  status: JobStatus;
  label: string;
}

const driverStatusActions: Partial<Record<JobStatus, DriverStatusAction[]>> = {
  accepted: [{ status: "en_route", label: "Leggja af stað" }],
  en_route: [{ status: "on_scene", label: "Kominn á staðinn" }],
  on_scene: [
    { status: "completed", label: "Ljúka verkefni" },
    { status: "in_progress", label: "Skrá vinnu í gangi" },
  ],
  in_progress: [
    { status: "completed", label: "Ljúka verkefni" },
    { status: "transporting", label: "Skrá flutning" },
  ],
  transporting: [{ status: "completed", label: "Ljúka verkefni" }],
};

export function getDriverStatusActions(status: JobStatus): DriverStatusAction[] {
  return driverStatusActions[status] ?? [];
}

export function buildDirectionsHref(latitude: number, longitude: number) {
  const destination = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function formatDriverTimestamp(value: string) {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}. kl. ${hours}:${minutes}`;
}
