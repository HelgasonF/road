"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { passwordSetupSchema } from "./schemas";

export type LoginState = { error?: string };
export type PasswordSetupState = { error?: string };

const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8),
});

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (isDemoMode()) redirect("/");
  if (!hasSupabaseConfig()) return { error: "Tengingu við Supabase vantar." };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Sláðu inn gilt netfang og lykilorð." };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: "Netfang eða lykilorð er rangt." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile || profile.role === "pending") {
    await supabase.auth.signOut();
    return { error: "Aðgangur hefur ekki verið virkjaður af stjórnanda." };
  }

  if (profile.role === "driver") {
    const { data: operatorId } = await supabase.rpc("current_operator_id");
    if (!operatorId) {
      await supabase.auth.signOut();
      return { error: "Ökumannsaðgangur er ekki tengdur þjónustuaðila." };
    }
    await supabase.rpc("activate_current_driver_access");
    redirect("/driver");
  }

  redirect("/");
}

export async function logoutAction() {
  if (!isDemoMode() && hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function setPasswordAction(
  _previousState: PasswordSetupState,
  formData: FormData,
): Promise<PasswordSetupState> {
  if (isDemoMode() || !hasSupabaseConfig()) return { error: "Tengingu við Supabase vantar." };

  const parsed = passwordSetupSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Lykilorðin þurfa að vera eins, að minnsta kosti 10 stafir og innihalda bókstaf og tölu." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return { error: "Aðgangshlekkurinn er útrunninn. Biddu um nýjan hlekk." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claimsData.claims.sub)
    .maybeSingle();
  if (profile?.role !== "driver") return { error: "Þessi aðgangur er ekki tengdur ökumanni." };

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (updateError) return { error: "Ekki tókst að vista lykilorðið. Reyndu aftur." };

  const { error: activationError } = await supabase.rpc("activate_current_driver_access");
  if (activationError) return { error: "Lykilorðið var vistað en ökumannstengingin fannst ekki." };

  redirect("/driver");
}
