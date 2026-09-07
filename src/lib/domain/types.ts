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

export const appRoles = ["pending", "dispatcher", "admin", "driver"] as const;
export type AppRole = (typeof appRoles)[number];

export const billingPayerTypes = [
  "customer",
  "rental_company",
  "insurer",
  "business_account",
] as const;
export type BillingPayerType = (typeof billingPayerTypes)[number];

export const billingReceivableStatuses = [
  "missing_information",
  "draft",
  "ready_to_invoice",
  "invoiced",
  "paid",
  "overdue",
  "disputed",
  "refunded",
  "void",
] as const;
export type BillingReceivableStatus = (typeof billingReceivableStatuses)[number];

export const billingPayableStatuses = [
  "not_ready",
  "awaiting_provider_invoice",
  "approved",
  "paid",
  "disputed",
  "void",
] as const;
export type BillingPayableStatus = (typeof billingPayableStatuses)[number];

export const billingActions = [
  "details_updated",
  "issue_payer_invoice",
  "record_payer_payment",
  "mark_payer_overdue",
  "dispute_payer",
  "refund_payer",
  "approve_provider_invoice",
  "record_provider_payment",
  "dispute_provider",
  "reopen_payer",
  "reopen_provider",
  "void_billing",
] as const;
export type BillingAction = (typeof billingActions)[number];

export const jobContactChannels = ["whatsapp", "phone"] as const;
export type JobContactChannel = (typeof jobContactChannels)[number];

export const jobContactPurposes = ["availability", "assignment"] as const;
export type JobContactPurpose = (typeof jobContactPurposes)[number];

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

export type DriverAccessStatus = "pending" | "active" | "disabled";

export interface DriverAccess {
  status: DriverAccessStatus;
  linkCreatedAt: string | null;
  activatedAt: string | null;
  disabledAt: string | null;
}

export interface Operator {
  id: string;
  userId: string | null;
  driverAccess: DriverAccess | null;
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
  acceptedAt: string | null;
}

export interface JobPhoto {
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Job {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleRegistration: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  rentalCompany: string | null;
  peopleCount: number | null;
  latitude: number;
  longitude: number;
  locationLabel: string;
  locationSource: LocationSource;
  status: JobStatus;
  priority: JobPriority;
  notes: string | null;
  customerNotes: string | null;
  customerIntakeSubmittedAt: string | null;
  intakePending: boolean;
  photos: JobPhoto[];
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

export interface AuthenticatedIdentity {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  operatorId: string | null;
}

export type DispatcherIdentity = AuthenticatedIdentity;

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
