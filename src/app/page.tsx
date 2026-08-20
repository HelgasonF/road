import { redirect } from "next/navigation";

import { getAuthenticatedLandingPath } from "@/features/auth/routing";
import { getCustomerIntakeLinkSummaries } from "@/features/customer-intake/queries";
import { DispatcherWorkspace } from "@/features/dispatch/dispatcher-workspace";
import { demoJobMatches, demoJobs } from "@/features/jobs/demo-data";
import { getJobOperatorMatches, getJobs } from "@/features/jobs/queries";
import { demoCapabilities, demoOperators } from "@/features/operators/demo-data";
import { getCapabilities, getOperators } from "@/features/operators/queries";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import { is } from "@/lib/i18n/is";

export const dynamic = "force-dynamic";

function ConfigurationNeeded() {
  return (
    <main className="centered-state setup-state">
      <span className="setup-badge">ENV</span>
      <h1>{is.configurationNeeded}</h1>
      <p>{is.configurationHelp}</p>
      <code>NEXT_PUBLIC_SUPABASE_URL</code>
      <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
    </main>
  );
}

export default async function Home() {
  const demoMode = isDemoMode();
  if (!demoMode && !hasSupabaseConfig()) return <ConfigurationNeeded />;

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role === "driver") redirect(getAuthenticatedLandingPath(identity) ?? "/login");
  if (identity.role !== "dispatcher" && identity.role !== "admin") redirect("/login");

  const [operators, capabilities, jobs, jobMatches, customerLinks] = demoMode
    ? [demoOperators, demoCapabilities, demoJobs, demoJobMatches, []]
    : await Promise.all([
      getOperators(),
      getCapabilities(),
      getJobs(),
      getJobOperatorMatches(),
      getCustomerIntakeLinkSummaries(),
    ]);

  return (
    <DispatcherWorkspace
      capabilities={capabilities}
      customerLinks={customerLinks}
      demoMode={demoMode}
      identity={identity}
      jobMatches={jobMatches}
      jobs={jobs}
      operators={operators}
    />
  );
}
