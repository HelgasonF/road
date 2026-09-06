"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { hasSupabaseAdminConfig, isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildDriverAccessPath, getDriverAuthEmail } from "./driver-access";
import {
  availabilityInputSchema,
  driverAccessLinkSchema,
  driverAccessToggleSchema,
  operatorInputSchema,
  type OperatorInput,
  vehicleInputSchema,
  type VehicleInput,
} from "./schemas";

const demoError = "Ekki er hægt að vista breytingar í sýnisham.";
const authError = "Innskráning rann út. Skráðu þig inn aftur.";
const adminConfigError = "Stjórnendalykill Supabase vantar á þjóninum.";

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    ok: false,
    error: "Farðu yfir innsláttinn og reyndu aftur.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies ActionResult;
}

export async function saveOperatorAction(input: OperatorInput): Promise<ActionResult<{ id: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

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
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

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
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

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

async function getDriverAccessTarget(operatorId: string) {
  const supabase = await createClient();
  const { data: operator, error } = await supabase
    .from("operators")
    .select("id, user_id, name, driver_access_disabled_at")
    .eq("id", operatorId)
    .maybeSingle();

  if (error || !operator) return { error: "Þjónustuaðilinn fannst ekki." } as const;
  return { operator } as const;
}

export async function createDriverAccessLinkAction(input: unknown): Promise<ActionResult<{ path: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  if (!hasSupabaseAdminConfig()) return { ok: false, error: adminConfigError };

  const parsed = driverAccessLinkSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const target = await getDriverAccessTarget(parsed.data.operatorId);
  if ("error" in target) return { ok: false, error: target.error };
  if (target.operator.driver_access_disabled_at) {
    return { ok: false, error: "Virkjaðu ökumannsaðganginn áður en nýr tengill er búinn til." };
  }

  const admin = createAdminClient();
  const createsUser = !target.operator.user_id;
  let authEmail = getDriverAuthEmail(target.operator.id);

  if (target.operator.user_id) {
    const { data: existingUser, error: userError } = await admin.auth.admin.getUserById(target.operator.user_id);
    if (userError || !existingUser.user) return { ok: false, error: "Innskráningin fannst ekki í Supabase Auth." };
    if (!existingUser.user.email) return { ok: false, error: "Innskráningin hefur ekkert innra auðkenni." };
    authEmail = existingUser.user.email;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
    options: {
      data: {
        display_name: target.operator.name,
        operator_id: target.operator.id,
      },
    },
  });

  if (error || !data.user || !data.properties.hashed_token) {
    return { ok: false, error: "Ekki tókst að búa til öruggan ökumannstengil." };
  }
  const verificationType = data.properties.verification_type;
  if (verificationType !== "signup" && verificationType !== "magiclink") {
    if (createsUser) await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "Supabase skilaði óþekktri tegund ökumannstengils." };
  }

  if (createsUser) {
    const { error: linkError } = await supabase.rpc("link_driver_user", {
      p_operator_id: target.operator.id,
      p_user_id: data.user.id,
    });

    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, error: "Ekki tókst að tengja ökumannsaðganginn við þjónustuaðilann." };
    }
  }

  const { error: timestampError } = await supabase
    .from("operators")
    .update({ driver_access_link_created_at: new Date().toISOString() })
    .eq("id", target.operator.id);

  if (timestampError) {
    if (createsUser) await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "Ekki tókst að skrá nýja ökumannstengilinn." };
  }

  revalidatePath("/");
  return {
    ok: true,
    data: { path: buildDriverAccessPath(data.properties.hashed_token, verificationType) },
  };
}

export async function setDriverAccessDisabledAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  if (!hasSupabaseAdminConfig()) return { ok: false, error: adminConfigError };

  const parsed = driverAccessToggleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const target = await getDriverAccessTarget(parsed.data.operatorId);
  if ("error" in target) return { ok: false, error: target.error };
  if (!target.operator.user_id) return { ok: false, error: "Enginn ökumannsaðgangur er skráður." };

  const admin = createAdminClient();
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(
    target.operator.user_id,
    { ban_duration: parsed.data.disabled ? "876000h" : "none" },
  );
  if (authUpdateError) return { ok: false, error: "Ekki tókst að breyta innskráningaraðganginum." };

  const supabase = await createClient();
  const { error: stateError } = await supabase.rpc("set_driver_access_disabled", {
    p_operator_id: target.operator.id,
    p_disabled: parsed.data.disabled,
  });

  if (stateError) {
    await admin.auth.admin.updateUserById(
      target.operator.user_id,
      { ban_duration: parsed.data.disabled ? "none" : "876000h" },
    );
    return { ok: false, error: "Ekki tókst að vista aðgangsstöðuna." };
  }

  revalidatePath("/");
  revalidatePath("/driver");
  return {
    ok: true,
    data: { message: parsed.data.disabled ? "Ökumannsaðgangi var lokað." : "Ökumannsaðgangur var virkjaður aftur." },
  };
}
