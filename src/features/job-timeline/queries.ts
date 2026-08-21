import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildJobTimeline } from "./timeline";
import type { JobTimelinePageData, JobTimelineSources } from "./types";

type ProfileName = { display_name: string } | null;

type JobRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  latitude: number;
  longitude: number;
  location_label: string | null;
  status: JobTimelinePageData["job"]["status"];
  created_at: string;
  profiles: ProfileName;
};

type StatusRow = {
  id: number;
  from_status: JobTimelineSources["statusEvents"][number]["fromStatus"];
  to_status: JobTimelineSources["statusEvents"][number]["toStatus"];
  changed_at: string;
  notes: string | null;
  profiles: ProfileName;
};

type LinkRow = {
  id: string;
  created_at: string;
  first_opened_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  submitted_at: string | null;
  profiles: ProfileName;
};

type PhotoRow = {
  id: string;
  original_filename: string;
  uploaded_at: string | null;
};

type AssignmentRow = {
  id: string;
  assigned_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  unassigned_at: string | null;
  notes: string | null;
  operators: { name: string } | null;
  vehicles: { name: string } | null;
  profiles: ProfileName;
};

type ContactRow = {
  id: number;
  channel: JobTimelineSources["contactEvents"][number]["channel"];
  purpose: JobTimelineSources["contactEvents"][number]["purpose"];
  initiated_at: string;
  operators: { name: string } | null;
  profiles: ProfileName;
};

type BillingRow = {
  id: number;
  action: JobTimelineSources["billingEvents"][number]["action"];
  reference: string | null;
  due_at: string | null;
  notes: string | null;
  changed_at: string;
  profiles: ProfileName;
};

export async function getJobTimelinePageData(jobId: string): Promise<JobTimelinePageData | null> {
  const supabase = await createClient();
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      customer_name,
      customer_phone,
      latitude,
      longitude,
      location_label,
      status,
      created_at,
      profiles!jobs_created_by_fkey(display_name)
    `)
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw new Error(`Unable to load timeline job: ${jobError.message}`);
  if (!jobData) return null;

  const [statusResult, linksResult, photosResult, assignmentsResult, contactsResult, billingResult] = await Promise.all([
    supabase
      .from("job_status_history")
      .select("id, from_status, to_status, changed_at, notes, profiles!job_status_history_changed_by_fkey(display_name)")
      .eq("job_id", jobId),
    supabase
      .from("customer_intake_links")
      .select("id, created_at, first_opened_at, expires_at, revoked_at, submitted_at, profiles!customer_intake_links_created_by_fkey(display_name)")
      .eq("job_id", jobId),
    supabase
      .from("job_photos")
      .select("id, original_filename, uploaded_at")
      .eq("job_id", jobId)
      .not("uploaded_at", "is", null),
    supabase
      .from("job_assignments")
      .select(`
        id,
        assigned_at,
        accepted_at,
        declined_at,
        decline_reason,
        unassigned_at,
        notes,
        operators(name),
        vehicles(name),
        profiles!job_assignments_assigned_by_fkey(display_name)
      `)
      .eq("job_id", jobId),
    supabase
      .from("job_contact_events")
      .select("id, channel, purpose, initiated_at, operators(name), profiles!job_contact_events_initiated_by_fkey(display_name)")
      .eq("job_id", jobId),
    supabase
      .from("job_billing_events")
      .select("id, action, reference, due_at, notes, changed_at, profiles!job_billing_events_changed_by_fkey(display_name)")
      .eq("job_id", jobId),
  ]);

  const failed = [statusResult, linksResult, photosResult, assignmentsResult, contactsResult, billingResult]
    .find((result) => result.error);
  if (failed?.error) throw new Error(`Unable to load job timeline: ${failed.error.message}`);

  const job = jobData as unknown as JobRow;
  const statusRows = statusResult.data as unknown as StatusRow[];
  const linkRows = linksResult.data as unknown as LinkRow[];
  const photoRows = photosResult.data as unknown as PhotoRow[];
  const assignmentRows = assignmentsResult.data as unknown as AssignmentRow[];
  const contactRows = contactsResult.data as unknown as ContactRow[];
  const billingRows = billingResult.data as unknown as BillingRow[];

  const sources: JobTimelineSources = {
    job: {
      id: job.id,
      createdAt: job.created_at,
      createdByName: job.profiles?.display_name ?? "Óþekktur notandi",
    },
    statusEvents: statusRows.map((row) => ({
      id: row.id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedAt: row.changed_at,
      changedByName: row.profiles?.display_name ?? "Óþekktur notandi",
      notes: row.notes,
    })),
    customerLinks: linkRows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      createdByName: row.profiles?.display_name ?? "Óþekktur notandi",
      firstOpenedAt: row.first_opened_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      submittedAt: row.submitted_at,
    })),
    photos: photoRows.flatMap((row) => row.uploaded_at ? [{
      id: row.id,
      originalFilename: row.original_filename,
      uploadedAt: row.uploaded_at,
    }] : []),
    assignments: assignmentRows.map((row) => ({
      id: row.id,
      operatorName: row.operators?.name ?? "Óþekktur þjónustuaðili",
      vehicleName: row.vehicles?.name ?? null,
      assignedByName: row.profiles?.display_name ?? "Óþekktur notandi",
      assignedAt: row.assigned_at,
      acceptedAt: row.accepted_at,
      declinedAt: row.declined_at,
      declineReason: row.decline_reason,
      unassignedAt: row.unassigned_at,
      notes: row.notes,
    })),
    contactEvents: contactRows.map((row) => ({
      id: row.id,
      operatorName: row.operators?.name ?? "óþekktan þjónustuaðila",
      channel: row.channel,
      purpose: row.purpose,
      initiatedByName: row.profiles?.display_name ?? "Óþekktur notandi",
      initiatedAt: row.initiated_at,
    })),
    billingEvents: billingRows.map((row) => ({
      id: row.id,
      action: row.action,
      changedByName: row.profiles?.display_name ?? "Óþekktur notandi",
      changedAt: row.changed_at,
      reference: row.reference,
      dueAt: row.due_at,
      notes: row.notes,
    })),
  };

  return {
    job: {
      id: job.id,
      customerName: job.customer_name,
      customerPhone: job.customer_phone,
      locationLabel: job.location_label ?? `${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)}`,
      status: job.status,
      createdAt: job.created_at,
    },
    events: buildJobTimeline(sources),
  };
}
