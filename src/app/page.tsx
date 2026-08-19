import { redirect } from "next/navigation";

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

  const [operators, capabilities, jobs, jobMatches] = demoMode
    ? [demoOperators, demoCapabilities, demoJobs, demoJobMatches]
    : await Promise.all([getOperators(), getCapabilities(), getJobs(), getJobOperatorMatches()]);

  return (
    <DispatcherWorkspace
      capabilities={capabilities}
      demoMode={demoMode}
      identity={identity}
      jobMatches={jobMatches}
      jobs={jobs}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null}
      operators={operators}
    />
  );
}
