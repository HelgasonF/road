"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: "Netfang eða lykilorð er rangt." };
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    return { error: "Aðgangur hefur ekki verið virkjaður af stjórnanda." };
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
