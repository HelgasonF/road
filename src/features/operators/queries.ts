import "server-only";

import type { Capability, CapabilityCode, Operator, VehicleType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

type OperatorQueryRow = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  company_name: string | null;
  is_active: boolean;
  availability_status: Operator["availabilityStatus"];
  base_address: string;
  base_latitude: number;
  base_longitude: number;
  current_latitude: number | null;
  current_longitude: number | null;
  current_location_updated_at: string | null;
  driver_access_link_created_at: string | null;
  driver_access_activated_at: string | null;
  driver_access_disabled_at: string | null;
  service_radius_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  operator_capabilities: { capability_code: CapabilityCode }[];
  vehicles: {
    id: string;
    operator_id: string;
    name: string;
    registration_number: string | null;
    vehicle_type: VehicleType;
    max_vehicle_weight_kg: number | null;
    is_active: boolean;
    notes: string | null;
    vehicle_capabilities: { capability_code: CapabilityCode }[];
  }[];
};

export async function getCapabilities(): Promise<Capability[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capabilities")
    .select("code, sort_order")
    .order("sort_order");

  if (error) throw new Error(`Unable to load capabilities: ${error.message}`);
  return data.map((capability) => ({
    code: capability.code,
    sortOrder: capability.sort_order,
  }));
}

export async function getOperators(): Promise<Operator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select(`
      id,
      user_id,
      name,
      phone,
      company_name,
      is_active,
      availability_status,
      base_address,
      base_latitude,
      base_longitude,
      current_latitude,
      current_longitude,
      current_location_updated_at,
      driver_access_link_created_at,
      driver_access_activated_at,
      driver_access_disabled_at,
      service_radius_km,
      notes,
      created_at,
      updated_at,
      operator_capabilities (capability_code),
      vehicles (
        id,
        operator_id,
        name,
        registration_number,
        vehicle_type,
        max_vehicle_weight_kg,
        is_active,
        notes,
        vehicle_capabilities (capability_code)
      )
    `)
    .order("name");

  if (error) throw new Error(`Unable to load operators: ${error.message}`);

  const rows = data as unknown as OperatorQueryRow[];
  return rows.map((operator) => ({
    id: operator.id,
    userId: operator.user_id,
    driverAccess: operator.user_id ? {
      status: operator.driver_access_disabled_at
        ? "disabled" as const
        : operator.driver_access_activated_at
          ? "active" as const
          : "pending" as const,
      linkCreatedAt: operator.driver_access_link_created_at,
      activatedAt: operator.driver_access_activated_at,
      disabledAt: operator.driver_access_disabled_at,
    } : null,
    name: operator.name,
    phone: operator.phone,
    companyName: operator.company_name,
    isActive: operator.is_active,
    availabilityStatus: operator.availability_status,
    baseAddress: operator.base_address,
    baseLatitude: operator.base_latitude,
    baseLongitude: operator.base_longitude,
    currentLatitude: operator.current_latitude,
    currentLongitude: operator.current_longitude,
    currentLocationUpdatedAt: operator.current_location_updated_at,
    serviceRadiusKm: operator.service_radius_km,
    notes: operator.notes,
    capabilities: operator.operator_capabilities.map((item) => item.capability_code),
    vehicles: operator.vehicles.map((vehicle) => ({
      id: vehicle.id,
      operatorId: vehicle.operator_id,
      name: vehicle.name,
      registrationNumber: vehicle.registration_number,
      vehicleType: vehicle.vehicle_type,
      maxVehicleWeightKg: vehicle.max_vehicle_weight_kg,
      isActive: vehicle.is_active,
      notes: vehicle.notes,
      capabilities: vehicle.vehicle_capabilities.map((item) => item.capability_code),
    })),
    createdAt: operator.created_at,
    updatedAt: operator.updated_at,
  }));
}
