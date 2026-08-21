"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { jobContactEventSchema } from "./schemas";

export async function recordJobContactAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: "Ekki er hægt að skrá samskipti í sýnisham." };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: "Innskráning rann út." };

  const parsed = jobContactEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógild samskiptaskráning." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_job_contact", {
    p_job_id: parsed.data.jobId,
    p_operator_id: parsed.data.operatorId,
    p_channel: parsed.data.channel,
    p_purpose: parsed.data.purpose,
  });
  if (error) return { ok: false, error: "Ekki tókst að skrá samskiptatilraunina." };

  revalidatePath(`/jobs/${parsed.data.jobId}/history`);
  return { ok: true };
}
