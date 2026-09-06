import type { LocationSuggestion } from "@/lib/domain/types";

export type HmsAddressSearchRow = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type HmsReverseGeocodeRow = HmsAddressSearchRow & {
  distance_meters: number;
};

export interface MapPinAddress {
  label: string;
  distanceMeters: number;
}

export function toLocationSuggestion(row: HmsAddressSearchRow): LocationSuggestion | null {
  if (!row.id || !row.label.trim()) return null;
  if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return null;
  if (row.latitude < 62 || row.latitude > 68 || row.longitude < -26 || row.longitude > -12) return null;

  return {
    id: row.id,
    label: row.label,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export function toMapPinAddress(row: HmsReverseGeocodeRow): MapPinAddress | null {
  const label = row.label.trim();
  if (!row.id || !label) return null;
  if (!Number.isFinite(row.distance_meters) || row.distance_meters < 0) return null;

  return {
    label,
    distanceMeters: row.distance_meters,
  };
}
