import type { LocationSuggestion } from "@/lib/domain/types";

export type MapboxFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    coordinates?: { longitude?: number; latitude?: number };
    full_address?: string;
    name?: string;
    name_preferred?: string;
    place_formatted?: string;
  };
};

export type MapboxResponse = {
  features?: MapboxFeature[];
  message?: string;
};

export function toIcelandLocationSuggestion(feature: MapboxFeature): LocationSuggestion | null {
  const longitude = feature.properties?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
  const latitude = feature.properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];
  const name = feature.properties?.name_preferred ?? feature.properties?.name;
  const label = feature.properties?.full_address
    ?? [name, feature.properties?.place_formatted].filter(Boolean).join(", ");

  if (!feature.id || !label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude! < 62 || latitude! > 68 || longitude! < -26 || longitude! > -12) return null;

  return { id: feature.id, label, latitude: latitude!, longitude: longitude! };
}
