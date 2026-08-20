import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

import type { AvailabilityStatus, Operator } from "@/lib/domain/types";

const EARTH_RADIUS_KM = 6371.0088;
const CIRCLE_SEGMENTS = 64;
const WEB_MERCATOR_METERS_PER_PIXEL_AT_ZOOM_ZERO = 156543.03392804097;

export interface OperatorCoverageProperties {
  operatorId: string;
  operatorName: string;
  radiusKm: number;
  availabilityStatus: AvailabilityStatus;
  selected: boolean;
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}

function toDegrees(radians: number) {
  return radians * 180 / Math.PI;
}

function pointAtDistance(
  longitude: number,
  latitude: number,
  distanceKm: number,
  bearingDegrees: number,
): Position {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDegrees);
  const startLatitude = toRadians(latitude);
  const startLongitude = toRadians(longitude);
  const endLatitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(angularDistance)
      + Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const endLongitude = startLongitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLatitude),
    Math.cos(angularDistance) - Math.sin(startLatitude) * Math.sin(endLatitude),
  );

  return [
    ((toDegrees(endLongitude) + 540) % 360) - 180,
    toDegrees(endLatitude),
  ];
}

function createCoverageFeature(
  operator: Operator,
  selectedOperatorId: string | null,
): Feature<Polygon, OperatorCoverageProperties> | null {
  const radiusKm = operator.serviceRadiusKm;
  if (!operator.isActive || radiusKm === null || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return null;
  }

  const latitude = operator.currentLatitude ?? operator.baseLatitude;
  const longitude = operator.currentLongitude ?? operator.baseLongitude;
  const ring = Array.from({ length: CIRCLE_SEGMENTS + 1 }, (_, index) =>
    pointAtDistance(longitude, latitude, radiusKm, -index * 360 / CIRCLE_SEGMENTS));

  return {
    type: "Feature",
    properties: {
      operatorId: operator.id,
      operatorName: operator.name,
      radiusKm,
      availabilityStatus: operator.availabilityStatus,
      selected: operator.id === selectedOperatorId,
    },
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

export function createOperatorCoverageGeoJson(
  operators: Operator[],
  selectedOperatorId: string | null,
): FeatureCollection<Polygon, OperatorCoverageProperties> {
  return {
    type: "FeatureCollection",
    features: operators
      .map((operator) => createCoverageFeature(operator, selectedOperatorId))
      .filter((feature): feature is Feature<Polygon, OperatorCoverageProperties> => feature !== null),
  };
}

export function getCoverageDiameterPixels(radiusKm: number, latitude: number, zoom: number) {
  const clampedLatitude = Math.max(-85, Math.min(85, latitude));
  const metersPerPixel = WEB_MERCATOR_METERS_PER_PIXEL_AT_ZOOM_ZERO
    * Math.cos(toRadians(clampedLatitude))
    / 2 ** zoom;
  return radiusKm * 2000 / metersPerPixel;
}
