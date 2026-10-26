"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { assignmentAccessPath, createAssignmentToken, hashAssignmentToken } from "@/features/auth/assignment-link";
import { invokeDriverAccessFunction } from "./driver-access-api";

const inputSchema = z.object({ jobId: z.uuid(), operatorId: z.uuid() }).strict();
const unavailable = "Ekki tókst að búa til verkefnistengil. Athugaðu að verkefnið sé opið og úthlutað þessum þjónustuaðila og að ökumannsaðgangur sé virkur.";

export async function createDriverAssignmentAccessLinkAction(input: unknown): Promise<ActionResult<{ path: string }>> {
  if (isDemoMode() || !(await getVerifiedStaffSession())) return { ok: false, error: "Innskráning starfsfólks er nauðsynleg." };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: unavailable };
  const { jobId, operatorId } = parsed.data;
  try {
    const client = await createClient();
    const [assignment, job, operator] = await Promise.all([
      client.from("job_assignments").select("id").eq("job_id", jobId).eq("operator_id", operatorId).is("unassigned_at", null).is("declined_at", null).maybeSingle(),
      client.from("jobs").select("status").eq("id", jobId).maybeSingle(),
      client.from("operators").select("user_id,is_active,driver_access_disabled_at").eq("id", operatorId).maybeSingle(),
    ]);
    if (assignment.error || job.error || operator.error || !assignment.data || !job.data || !operator.data
      || ["completed", "cancelled"].includes(job.data.status)
      || !operator.data.is_active || operator.data.driver_access_disabled_at) return { ok: false, error: unavailable };
    if (!operator.data.user_id) {
      // Reuse staff-authenticated account provisioning; generateLink delivers no email.
      const provisioned = await invokeDriverAccessFunction({ action: "create_link", operatorId });
      if (!provisioned.ok) return { ok: false, error: unavailable };
    }
    const token = createAssignmentToken();
    // This RPC locks/rechecks all authorization state before replacing a link.
    const { data, error } = await client.rpc("create_driver_assignment_link", {
      p_job_id: jobId, p_operator_id: operatorId, p_token_hash: hashAssignmentToken(token),
    });
    if (error || !data) return { ok: false, error: unavailable };
    revalidatePath("/");
    return { ok: true, data: { path: assignmentAccessPath(token) } };
  } catch {
    return { ok: false, error: unavailable };
  }
}
