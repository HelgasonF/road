import type { AuthenticatedIdentity } from "@/lib/domain/types";

export function getAuthenticatedLandingPath(identity: AuthenticatedIdentity | null) {
  if (!identity) return null;
  if (identity.role === "driver") return identity.operatorId ? "/driver" : null;
  if (identity.role === "dispatcher" || identity.role === "admin") return "/";
  return null;
}
