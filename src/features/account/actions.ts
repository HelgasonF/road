"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { getVerifiedAdminSession, getVerifiedStaffSession } from "@/lib/auth/session";
import { getSupabaseConfig, isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { changePasswordSchema, newStaffUserSchema } from "./schemas";

const demoError = "Ekki er hægt að breyta aðgangi í sýnisham.";
const PASSWORD_ATTEMPT_LIMIT = 10;
const PASSWORD_WINDOW_SECONDS = 15 * 60;
const CREATE_STAFF_LIMIT = 20;
const CREATE_STAFF_WINDOW_SECONDS = 60 * 60;

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    ok: false,
    error: "Farðu yfir innsláttinn og reyndu aftur.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies ActionResult;
}

/** Admin only: creates a confirmed email/password login with a staff role. */
export async function createStaffUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  const identity = await getVerifiedAdminSession();
  if (!identity) return { ok: false, error: "Aðeins stjórnendur geta búið til notendur." };
  if (!(await consumeRateLimit(`create-staff:${identity.id}`, CREATE_STAFF_LIMIT, CREATE_STAFF_WINDOW_SECONDS))) {
    return { ok: false, error: "Of margir notendur búnir til á stuttum tíma. Reyndu aftur síðar." };
  }

  const parsed = newStaffUserSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { displayName, email, password, role } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists") return { ok: false, error: "Notandi með þetta netfang er þegar til." };
    if (error?.code === "weak_password") return { ok: false, error: "Lykilorðið uppfyllir ekki kröfur." };
    return { ok: false, error: "Ekki tókst að búa til notandann." };
  }

  // New logins start as `pending`; set the role, or remove the login so a
  // half-created account cannot linger.
  const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "Ekki tókst að búa til notandann." };
  }

  revalidatePath("/account");
  return { ok: true, data: { id: data.user.id } };
}

/** Any staff member: changes their own password after confirming the current one. */
export async function changeOwnPasswordAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  const identity = await getVerifiedStaffSession();
  if (!identity) return { ok: false, error: "Innskráning rann út. Skráðu þig inn aftur." };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  if (!(await consumeRateLimit(`password-change:${identity.id}`, PASSWORD_ATTEMPT_LIMIT, PASSWORD_WINDOW_SECONDS))) {
    return { ok: false, error: "Of margar tilraunir. Reyndu aftur eftir nokkrar mínútur." };
  }

  // Check the current password on a throwaway client so the user's own
  // session cookies are not touched.
  const { url, publishableKey } = getSupabaseConfig();
  const verifier = createSupabaseClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: identity.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return { ok: false, error: "Núverandi lykilorð er rangt." };

  const { error } = await createAdminClient().auth.admin.updateUserById(identity.id, {
    password: parsed.data.newPassword,
  });
  if (error) return { ok: false, error: "Ekki tókst að breyta lykilorðinu." };
  return { ok: true };
}
