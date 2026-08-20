import "server-only";

import { cache } from "react";

import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import type { AuthenticatedIdentity, DispatcherIdentity } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

const demoIdentity: DispatcherIdentity = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "synishamur@vegstod.is",
  displayName: "Sýnishamur",
  role: "admin",
  operatorId: null,
};

export const getVerifiedSession = cache(async (): Promise<AuthenticatedIdentity | null> => {
  if (isDemoMode()) return demoIdentity;
  if (!hasSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, role")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile) return null;

  const operatorId = profile.role === "driver"
    ? (await supabase.rpc("current_operator_id")).data
    : null;

  return {
    id: claims.sub,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    operatorId,
  };
});

export async function getVerifiedStaffSession(): Promise<DispatcherIdentity | null> {
  const identity = await getVerifiedSession();
  return identity && (identity.role === "dispatcher" || identity.role === "admin")
    ? identity
    : null;
}
