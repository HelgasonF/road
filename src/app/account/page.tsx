import { redirect } from "next/navigation";

import { AccountWorkspace } from "@/features/account/account-workspace";
import { getStaffMembers } from "@/features/account/queries";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const demoMode = isDemoMode();
  if (!demoMode && !hasSupabaseConfig()) redirect("/login");

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role === "driver") redirect("/driver");
  if (identity.role !== "dispatcher" && identity.role !== "admin") redirect("/login");

  const staff = identity.role === "admin" && !demoMode ? await getStaffMembers() : [];
  return <AccountWorkspace identity={identity} staff={staff} />;
}
