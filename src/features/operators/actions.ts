"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { hasSupabaseAdminConfig, isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  availabilityInputSchema,
  driverAccessToggleSchema,
  driverInvitationSchema,
  driverPasswordResetSchema,
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
  if (!operator.user_id) return { operator, email: null } as const;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", operator.user_id)
    .maybeSingle();

  if (profileError || !profile) return { error: "Innskráningin fannst ekki." } as const;
  return { operator, email: profile.email } as const;
}

function invitationError(message?: string) {
  if (message?.toLowerCase().includes("rate limit")) {
    return "Of margir aðgangstölvupóstar hafa verið sendir. Reyndu aftur síðar.";
  }
  if (message?.toLowerCase().includes("already")) {
    return "Netfangið er þegar skráð í Supabase Auth.";
  }
  return "Ekki tókst að senda aðgangstölvupóstinn.";
}

export async function sendDriverInvitationAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  if (!hasSupabaseAdminConfig()) return { ok: false, error: adminConfigError };

  const parsed = driverInvitationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const target = await getDriverAccessTarget(parsed.data.operatorId);
  if ("error" in target) return { ok: false, error: target.error };
  if (target.operator.user_id && target.email !== parsed.data.email) {
    return { ok: false, error: "Þjónustuaðilinn er þegar tengdur öðru netfangi." };
  }

  const admin = createAdminClient();
  if (target.operator.user_id) {
    const { data: existingUser, error: userError } = await admin.auth.admin.getUserById(target.operator.user_id);
    if (userError || !existingUser.user) return { ok: false, error: "Innskráningin fannst ekki í Supabase Auth." };

    if (existingUser.user.email_confirmed_at) {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
      if (recoveryError) return { ok: false, error: invitationError(recoveryError.message) };
      return { ok: true, data: { message: "Nýr lykilorðshlekkur var sendur." } };
    }
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      display_name: target.operator.name,
      operator_id: target.operator.id,
    },
  });

  if (error || !data.user) return { ok: false, error: invitationError(error?.message) };

  if (!target.operator.user_id) {
    const { error: linkError } = await supabase.rpc("link_driver_user", {
      p_operator_id: target.operator.id,
      p_user_id: data.user.id,
    });

    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, error: "Boðið var ekki sent vegna þess að ekki tókst að tengja innskráninguna." };
    }
  }

  revalidatePath("/");
  return {
    ok: true,
    data: { message: target.operator.user_id ? "Aðgangsboðið var sent aftur." : "Aðgangsboðið var sent." },
  };
}

export async function sendDriverPasswordResetAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

  const parsed = driverPasswordResetSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const target = await getDriverAccessTarget(parsed.data.operatorId);
  if ("error" in target) return { ok: false, error: target.error };
  if (!target.operator.user_id || !target.email) return { ok: false, error: "Enginn ökumannsaðgangur er skráður." };
  if (target.operator.driver_access_disabled_at) return { ok: false, error: "Virkjaðu aðganginn áður en lykilorð er endurstillt." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(target.email);
  if (error) return { ok: false, error: invitationError(error.message) };

  return { ok: true, data: { message: "Endurstillingartölvupóstur var sendur." } };
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
