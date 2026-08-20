"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import {
  assignmentInputSchema,
  jobInputSchema,
  jobStatusInputSchema,
  type JobInput,
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

export async function saveJobAction(input: JobInput): Promise<ActionResult<{ id: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_job", {
    p_id: value.id,
    p_customer_name: value.customerName,
    p_customer_phone: value.customerPhone,
    p_vehicle_registration: value.vehicleRegistration,
    p_vehicle_make: value.vehicleMake,
    p_vehicle_model: value.vehicleModel,
    p_vehicle_type: value.vehicleType,
    p_latitude: value.latitude,
    p_longitude: value.longitude,
    p_location_label: value.locationLabel,
    p_location_source: value.locationSource,
    p_priority: value.priority,
    p_notes: value.notes,
    p_required_capabilities: value.requiredCapabilities,
  });

  if (error) return { ok: false, error: "Ekki tókst að vista verkefnið." };
  revalidatePath("/");
  return { ok: true, data: { id: data } };
}

export async function assignJobAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  const parsed = assignmentInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_job", {
    p_job_id: value.jobId,
    p_operator_id: value.operatorId,
    p_vehicle_id: value.vehicleId,
    p_notes: value.notes,
  });
  if (error) return { ok: false, error: "Ekki tókst að úthluta verkefninu." };
  revalidatePath("/");
  return { ok: true };
}

export async function updateJobStatusAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  const parsed = jobStatusInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_job_status", {
    p_job_id: value.jobId,
    p_status: value.status,
    p_notes: value.notes,
  });
  if (error) return { ok: false, error: "Ekki tókst að uppfæra stöðu verkefnisins." };
  revalidatePath("/");
  return { ok: true };
}
