"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import {
  driverAssignmentResponseSchema,
  driverAvailabilitySchema,
  driverJobStatusSchema,
} from "./schemas";

const demoError = "Ekki er hægt að vista breytingar í sýnisham.";
const accessError = "Ökumannsaðgangur fannst ekki. Skráðu þig inn aftur.";

async function hasDriverAccess() {
  const identity = await getVerifiedSession();
  return identity?.role === "driver" && Boolean(identity.operatorId);
}

export async function setDriverAvailabilityAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await hasDriverAccess())) return { ok: false, error: accessError };

  const parsed = driverAvailabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógild staða." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_driver_availability", {
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: "Ekki tókst að breyta stöðu þinni." };

  revalidatePath("/driver");
  revalidatePath("/");
  return { ok: true };
}

export async function respondToDriverAssignmentAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await hasDriverAccess())) return { ok: false, error: accessError };

  const parsed = driverAssignmentResponseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ógilt svar." };
  }

  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("respond_to_driver_assignment", {
    p_assignment_id: parsed.data.assignmentId,
    p_accept: parsed.data.accept,
    p_notes: parsed.data.notes,
  });
  if (error) return { ok: false, error: "Ekki tókst að senda svar við úthlutuninni." };

  revalidatePath("/driver");
  revalidatePath("/");
  if (jobId) revalidatePath(`/jobs/${jobId}/history`);
  return { ok: true };
}

export async function updateDriverJobStatusAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await hasDriverAccess())) return { ok: false, error: accessError };

  const parsed = driverJobStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógild stöðubreyting." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_driver_job_status", {
    p_job_id: parsed.data.jobId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes,
  });
  if (error) return { ok: false, error: "Ekki tókst að uppfæra verkefnið." };

  revalidatePath("/driver");
  revalidatePath("/");
  revalidatePath(`/jobs/${parsed.data.jobId}/history`);
  return { ok: true };
}
