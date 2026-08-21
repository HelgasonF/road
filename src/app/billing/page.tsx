import { redirect } from "next/navigation";

import { BillingWorkspace } from "@/features/billing/billing-workspace";
import { buildDemoBillingRecords } from "@/features/billing/demo-data";
import {
  buildJobBillingCases,
  getJobBillingEvents,
  getJobBillingRecords,
} from "@/features/billing/queries";
import { demoJobs } from "@/features/jobs/demo-data";
import { getJobs } from "@/features/jobs/queries";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const demoMode = isDemoMode();
  if (!demoMode && !hasSupabaseConfig()) redirect("/login");

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role === "driver") redirect("/driver");
  if (identity.role !== "dispatcher" && identity.role !== "admin") redirect("/login");

  const params = await searchParams;
  const [jobs, records, events] = demoMode
    ? [demoJobs, buildDemoBillingRecords(demoJobs), []]
    : await Promise.all([getJobs(), getJobBillingRecords(), getJobBillingEvents()]);

  return (
    <BillingWorkspace
      billingCases={buildJobBillingCases(jobs, records)}
      demoMode={demoMode}
      events={events}
      identity={identity}
      initialJobId={params.job ?? null}
    />
  );
}
