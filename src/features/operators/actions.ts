"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import {
  availabilityInputSchema,
  operatorInputSchema,
  type OperatorInput,
  vehicleInputSchema,
  type VehicleInput,
} from "./schemas";

const demoError = "Ekki er hægt að vista breytingar í sýnisham.";
const authError = "Innskráning rann út. Skráðu þig inn aftur.";

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    ok: false,
    error: "Farðu yfir innsláttinn og reyndu aftur.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies ActionResult;
}

export async function saveOperatorAction(input: OperatorInput): Promise<ActionResult<{ id: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedSession())) return { ok: false, error: authError };

  const parsed = operatorInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const value = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_operator", {
    p_id: value.id,
    p_name: value.name,
    p_phone: value.phone,
    p_company_name: value.companyName,
    p_is_active: value.isActive,
    p_availability_status: value.availabilityStatus,
    p_base_address: value.baseAddress,
    p_base_latitude: value.baseLatitude,
    p_base_longitude: value.baseLongitude,
    p_current_latitude: value.currentLatitude,
    p_current_longitude: value.currentLongitude,
    p_service_radius_km: value.serviceRadiusKm,
    p_notes: value.notes,
    p_capabilities: value.capabilities,
  });

  if (error) return { ok: false, error: "Ekki tókst að vista þjónustuaðilann." };
  revalidatePath("/");
  return { ok: true, data: { id: data } };
}

export async function saveVehicleAction(input: VehicleInput): Promise<ActionResult<{ id: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedSession())) return { ok: false, error: authError };

  const parsed = vehicleInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const value = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_vehicle", {
    p_id: value.id,
    p_operator_id: value.operatorId,
    p_name: value.name,
    p_registration_number: value.registrationNumber,
    p_vehicle_type: value.vehicleType,
    p_max_vehicle_weight_kg: value.maxVehicleWeightKg,
    p_is_active: value.isActive,
    p_notes: value.notes,
    p_capabilities: value.capabilities,
  });

  if (error) return { ok: false, error: "Ekki tókst að vista ökutækið." };
  revalidatePath("/");
  return { ok: true, data: { id: data } };
}

export async function updateAvailabilityAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedSession())) return { ok: false, error: authError };

  const parsed = availabilityInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("operators")
    .update({ availability_status: parsed.data.availabilityStatus })
    .eq("id", parsed.data.operatorId);

  if (error) return { ok: false, error: "Ekki tókst að breyta stöðu." };
  revalidatePath("/");
  return { ok: true };
}
