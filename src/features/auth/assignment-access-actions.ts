"use server";

import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseAdminConfig, isDemoMode } from "@/lib/config";
import { consumeRateLimit, requestAddress } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assignmentTokenSchema, hashAssignmentToken } from "./assignment-link";
import { openAssignmentAccess } from "./assignment-access-service";

export type AssignmentAccessState = { error?: string };
const unavailable = "Ekki tókst að opna verkefnið. Reyndu aftur eða hafðu samband við aðgerðastjórn.";
const closed = "Tengillinn er ekki lengur virkur. Verkefninu gæti verið lokið, úthlutunin breyst eða aðganginum verið lokað. Hafðu samband við aðgerðastjórn.";

export async function openDriverAssignmentAccessAction(_state: AssignmentAccessState, form: FormData): Promise<AssignmentAccessState> {
  if (isDemoMode() || !hasSupabaseAdminConfig()) return { error: unavailable };
  const parsed = assignmentTokenSchema.safeParse(form.get("assignmentToken"));
  if (!parsed.success) return { error: closed };
  const tokenHash = hashAssignmentToken(parsed.data);
  let jobId: string;
  try {
    const address = await requestAddress();
    const allowed = await Promise.all([
      consumeRateLimit(`driver-assignment:ip:${address}`, 60, 10 * 60),
      consumeRateLimit(`driver-assignment:link:${tokenHash}`, 30, 10 * 60),
    ]);
    if (allowed.includes(false)) return { error: "Of margar tilraunir. Bíddu í nokkrar mínútur og reyndu aftur." };
    const admin = createAdminClient();
    const client = await createClient();
    const signOut = async () => {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw new Error("Assignment session cleanup failed");
    };
    const result = await openAssignmentAccess({
      resolve: async () => {
        const { data, error } = await admin.rpc("resolve_driver_assignment_link", { p_token_hash: tokenHash });
        if (error) throw new Error("Assignment state unavailable");
        const row = data?.[0];
        return row ? { assignmentId: row.assignment_id, jobId: row.job_id, operatorId: row.operator_id, userId: row.driver_user_id } : null;
      },
      currentDriver: async () => {
        const identity = await getVerifiedSession();
        return identity?.role === "driver" && identity.operatorId ? { userId: identity.id, operatorId: identity.operatorId } : null;
      },
      signIn: async (userId) => {
        const account = await admin.auth.admin.getUserById(userId);
        if (account.error || account.data.user?.id !== userId || !account.data.user.email
          || (account.data.user.banned_until && new Date(account.data.user.banned_until).getTime() > Date.now())) return false;
        const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: account.data.user.email });
        const type = generated.data.properties?.verification_type;
        const otp = generated.data.properties?.hashed_token;
        if (generated.error || generated.data.user?.id !== userId || !otp || (type !== "signup" && type !== "magiclink")) return false;
        let createdSession = false;
        let ready = false;
        try {
          const verified = await client.auth.verifyOtp({ token_hash: otp, type });
          createdSession = Boolean(verified.data.session);
          if (verified.error || verified.data.user?.id !== userId) return false;
          const activated = await client.rpc("activate_current_driver_access");
          if (activated.error) return false;
          ready = true;
          return true;
        } finally {
          if (createdSession && !ready) await signOut();
        }
      },
      signOut,
    });
    if (!result.ok) return { error: result.reason === "closed" ? closed : unavailable };
    jobId = result.jobId;
  } catch {
    return { error: unavailable };
  }
  redirect(`/driver?job=${encodeURIComponent(jobId)}`);
}
