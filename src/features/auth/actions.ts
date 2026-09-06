"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { driverAccessTokenSchema } from "./driver-access";

export type LoginState = { error?: string };
export type DriverAccessState = { error?: string };

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

export async function openDriverAccessAction(
  _previousState: DriverAccessState,
  formData: FormData,
): Promise<DriverAccessState> {
  if (isDemoMode() || !hasSupabaseConfig()) return { error: "Tengingu við Supabase vantar." };

  const parsed = driverAccessTokenSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: "Aðgangstengillinn er ógildur." };

  const supabase = await createClient();
  const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.tokenHash,
    type: parsed.data.type,
  });
  if (verifyError || !authData.user) {
    return { error: "Aðgangstengillinn er útrunninn eða hefur þegar verið notaður. Biddu aðgerðastjórn um nýjan tengil." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profile?.role !== "driver") {
    await supabase.auth.signOut();
    return { error: "Þessi tengill er ekki tengdur ökumanni." };
  }

  const { error: activationError } = await supabase.rpc("activate_current_driver_access");
  if (activationError) {
    await supabase.auth.signOut();
    return { error: "Ökumannstengingin fannst ekki eða aðganginum hefur verið lokað." };
  }

  redirect("/driver");
}
