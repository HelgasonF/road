import { redirect } from "next/navigation";

import { DriverWorkspace } from "@/features/driver/driver-workspace";
import { demoJobs } from "@/features/jobs/demo-data";
import { getJobs } from "@/features/jobs/queries";
import { demoOperators } from "@/features/operators/demo-data";
import { getOperators } from "@/features/operators/queries";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import type { AuthenticatedIdentity } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const demoDriverIdentity: AuthenticatedIdentity = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "anna@vegstod.local",
  displayName: "Anna S. Jónsdóttir",
  role: "driver",
  operatorId: "10000000-0000-4000-8000-000000000002",
};

export default async function DriverPage() {
  const demoMode = isDemoMode();
  if (!demoMode && !hasSupabaseConfig()) redirect("/login");

  if (demoMode) {
    const operator = demoOperators.find((item) => item.id === demoDriverIdentity.operatorId)!;
    const jobs = demoJobs.filter((job) => job.assignment?.operatorId === operator.id);
    return <DriverWorkspace demoMode identity={demoDriverIdentity} jobs={jobs} operator={operator} />;
  }

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role !== "driver") redirect("/");
  if (!identity.operatorId) redirect("/login");

  const [operators, jobs] = await Promise.all([getOperators(), getJobs()]);
  const operator = operators.find((item) => item.id === identity.operatorId);
  if (!operator) redirect("/login");

  return <DriverWorkspace demoMode={false} identity={identity} jobs={jobs} operator={operator} />;
}
