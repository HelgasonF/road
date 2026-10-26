import { redirect } from "next/navigation";

import { DriverWorkspace } from "@/features/driver/driver-workspace";
import { demoJobs } from "@/features/jobs/demo-data";
import { getJobs } from "@/features/jobs/queries";
import { demoOperators } from "@/features/operators/demo-data";
import { getOperators } from "@/features/operators/queries";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

const demoDriverOperatorId = "10000000-0000-4000-8000-000000000002";

export default async function DriverPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: requestedJobId } = await searchParams;
  const demoMode = isDemoMode();
  if (!demoMode && !hasSupabaseConfig()) redirect("/login");

  if (demoMode) {
    const operator = demoOperators.find((item) => item.id === demoDriverOperatorId)!;
    const jobs = demoJobs.filter((job) => job.assignment?.operatorId === operator.id);
    return <DriverWorkspace demoMode jobs={jobs} operator={operator} />;
  }

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role !== "driver") redirect("/");
  if (!identity.operatorId) redirect("/login");

  const [operators, jobs] = await Promise.all([getOperators(), getJobs()]);
  const operator = operators.find((item) => item.id === identity.operatorId);
  if (!operator) redirect("/login");

  const initialJobId = jobs.find((job) => job.id === requestedJobId)?.id;
  return <DriverWorkspace key={initialJobId ?? operator.id} initialJobId={initialJobId} demoMode={false} jobs={jobs} operator={operator} />;
}
