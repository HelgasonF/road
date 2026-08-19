export const capabilityCodes = [
  "towing",
  "flatbed",
  "jump_start",
  "tire_assistance",
  "fuel_delivery",
  "lockout",
  "four_by_four_recovery",
  "ev_assistance",
  "accident_recovery",
  "heavy_vehicle",
  "other",
] as const;

export type CapabilityCode = (typeof capabilityCodes)[number];

export const availabilityStatuses = [
  "available",
  "busy",
  "offline",
  "unavailable",
] as const;

export type AvailabilityStatus = (typeof availabilityStatuses)[number];

export const vehicleTypes = [
  "tow_truck",
  "flatbed_truck",
  "service_van",
  "recovery_4x4",
  "heavy_recovery",
  "other",
] as const;

export type VehicleType = (typeof vehicleTypes)[number];

export const jobStatuses = [
  "new",
  "assigned",
  "accepted",
  "en_route",
  "on_scene",
  "in_progress",
  "transporting",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const jobPriorities = ["low", "normal", "high", "urgent"] as const;
export type JobPriority = (typeof jobPriorities)[number];

export const locationSources = ["search", "map_pin", "manual", "gps"] as const;
export type LocationSource = (typeof locationSources)[number];

export interface Capability {
  code: CapabilityCode;
  sortOrder: number;
}

export interface Vehicle {
  id: string;
  operatorId: string;
  name: string;
  registrationNumber: string | null;
  vehicleType: VehicleType;
  maxVehicleWeightKg: number | null;
  isActive: boolean;
  notes: string | null;
  capabilities: CapabilityCode[];
}

export interface Operator {
  id: string;
  name: string;
  phone: string;
  companyName: string | null;
  isActive: boolean;
  availabilityStatus: AvailabilityStatus;
  baseAddress: string;
  baseLatitude: number;
  baseLongitude: number;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentLocationUpdatedAt: string | null;
  serviceRadiusKm: number | null;
  notes: string | null;
  capabilities: CapabilityCode[];
  vehicles: Vehicle[];
  createdAt: string;
  updatedAt: string;
}

export interface JobAssignment {
  id: string;
  operatorId: string;
  operatorName: string;
  vehicleId: string | null;
  vehicleName: string | null;
  assignedAt: string;
}

export interface Job {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleRegistration: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  latitude: number;
  longitude: number;
  locationLabel: string;
  locationSource: LocationSource;
  status: JobStatus;
  priority: JobPriority;
  notes: string | null;
  requiredCapabilities: CapabilityCode[];
  assignment: JobAssignment | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface LocationSuggestion {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface DispatcherIdentity {
  id: string;
  email: string;
  displayName: string;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
