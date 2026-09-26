import {
  DISTRICTS,
  LANDMARKS,
  type LandmarkPoint,
  type ReferencePoint,
  SETTLEMENTS,
} from "./iceland-reference-points";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface DriverAreaInput extends GeoPoint {
  locationLabel: string;
}

// Inside this radius the pin is described as the place itself.
const AT_PLACE_KM = 2;
// Up to this distance a town or village is a meaningful reference.
const NEAR_SETTLEMENT_KM = 15;
// A landmark further away than this tells the driver little.
const LANDMARK_MAX_KM = 40;
// Within this distance of a city district point the job is in that district.
const IN_DISTRICT_KM = 3;
// A job this close to a lowland site is at that site, not in the highlands.
const AT_LOWLAND_SITE_KM = 5;

const EARTH_RADIUS_KM = 6371;
const COMPASS = ["N", "NA", "A", "SA", "S", "SV", "V", "NV"] as const;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(from: GeoPoint, to: GeoPoint) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Eight-point Icelandic compass direction (N, NA, A, …) from `from` towards `to`. */
export function compassDirection(from: GeoPoint, to: GeoPoint) {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return COMPASS[Math.round(bearing / 45) % COMPASS.length];
}

function nearest<T extends ReferencePoint>(points: readonly T[], target: GeoPoint) {
  let best: { point: T; km: number } | null = null;
  for (const point of points) {
    const km = distanceKm(point, target);
    if (!best || km < best.km) best = { point, km };
  }
  return best!;
}

function relativeTo(reference: { point: ReferencePoint; km: number }, target: GeoPoint) {
  if (reference.km <= AT_PLACE_KM) return reference.point.name;
  return `${reference.point.name}, um ${Math.round(reference.km)} km ${compassDirection(reference.point, target)}`;
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isPinnedLabel(label: string) {
  return /[+-]?\d{2}\.\d{3,}\s*,\s*[+-]?\d{2}\.\d{3,}/.test(label)
    || /^(?:gps|map pin|pinni á korti)\b/i.test(label);
}

/** Street without house number plus the rest of a typed address. */
function reduceTypedAddress(label: string) {
  const [primary, ...areaParts] = label.split(",").map((part) => part.trim());
  if (areaParts.length === 0) return label;
  const street = primary.replace(/\s+\d+(?:-\d+)?[a-záðéíóúýþæö]*$/iu, "").trim();
  return [street || primary, ...areaParts].join(", ");
}

/**
 * Approximate: highland when a highland reference point is nearer than any
 * town, unless the job is right at a lowland site such as Skógar.
 */
function isHighland(target: GeoPoint, settlementKm: number) {
  const highland = nearest(LANDMARKS.filter((point) => point.highland), target);
  const lowland = nearest(LANDMARKS.filter((point) => !point.highland), target);
  return highland.km <= LANDMARK_MAX_KM
    && highland.km < settlementKm
    && !(lowland.km <= AT_LOWLAND_SITE_KM && lowland.km < highland.km);
}

function describePinnedArea(target: GeoPoint) {
  const district = nearest(DISTRICTS, target);
  if (district.km <= IN_DISTRICT_KM) return `${district.point.town} – ${district.point.name}`;

  const settlement = nearest(SETTLEMENTS, target);
  if (settlement.km <= NEAR_SETTLEMENT_KM) return relativeTo(settlement, target);

  const prefix = isHighland(target, settlement.km) ? "Hálendi" : "Utan þéttbýlis";
  const landmark: { point: LandmarkPoint; km: number } = nearest(LANDMARKS, target);
  const reference = landmark.km < settlement.km && landmark.km <= LANDMARK_MAX_KM ? landmark : settlement;
  return `${prefix} – ${relativeTo(reference, target)}`;
}

/**
 * Area line for a driver who has not accepted the job yet: detailed enough to
 * decide, never the exact spot. Typed addresses lose their house number;
 * pinned locations are described relative to a town or known landmark.
 */
export function describeDriverArea({ locationLabel, latitude, longitude }: DriverAreaInput) {
  const label = oneLine(locationLabel);
  if (!isPinnedLabel(label)) return reduceTypedAddress(label);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Staðsetning skráð á korti";
  return describePinnedArea({ latitude, longitude });
}
