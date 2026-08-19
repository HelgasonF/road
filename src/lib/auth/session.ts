import "server-only";

import { cache } from "react";

import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import type { DispatcherIdentity } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

const demoIdentity: DispatcherIdentity = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "synishamur@vegstod.is",
  displayName: "Sýnishamur",
};

export const getVerifiedSession = cache(async (): Promise<DispatcherIdentity | null> => {
  if (isDemoMode()) return demoIdentity;
  if (!hasSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: claims.sub,
    email: profile.email,
    displayName: profile.display_name,
  };
});
