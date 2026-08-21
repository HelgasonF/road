import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { buildDemoJobTimelinePageData } from "@/features/job-timeline/demo-data";
import { getJobTimelinePageData } from "@/features/job-timeline/queries";
import { TimelineWorkspace } from "@/features/job-timeline/timeline-workspace";
import { demoJobs } from "@/features/jobs/demo-data";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function JobHistoryPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const demoMode = isDemoMode();
  if (!demoMode && !hasSupabaseConfig()) redirect("/login");

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role === "driver") redirect("/driver");
  if (identity.role !== "dispatcher" && identity.role !== "admin") redirect("/login");

  const { jobId } = await params;
  if (!z.uuid().safeParse(jobId).success) notFound();

  const data = demoMode
    ? (() => {
      const job = demoJobs.find((candidate) => candidate.id === jobId);
      return job ? buildDemoJobTimelinePageData(job) : null;
    })()
    : await getJobTimelinePageData(jobId);
  if (!data) notFound();

  return <TimelineWorkspace data={data} identity={identity} />;
}
