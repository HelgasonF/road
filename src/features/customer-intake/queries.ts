import "server-only";

import type { CapabilityCode, LocationSource } from "@/lib/domain/types";
import { hasSupabaseAdminConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { customerTokenSchema } from "./schemas";
import { hashCustomerIntakeToken } from "./tokens";

export type CustomerIntakeLinkStatus = "active" | "expired" | "revoked" | "submitted";

export interface CustomerIntakeLinkSummary {
  id: string;
  jobId: string;
  status: CustomerIntakeLinkStatus;
  expiresAt: string;
  submittedAt: string | null;
  createdAt: string;
}

export interface CustomerIntakePhoto {
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}

export interface ActiveCustomerIntake {
  status: "active";
  linkId: string;
  expiresAt: string;
  job: {
    id: string;
    customerName: string;
    customerPhone: string;
    vehicleRegistration: string | null;
    vehicleMake: string | null;
    rentalCompany: string | null;
    peopleCount: number | null;
    requiredCapability: CapabilityCode | null;
    latitude: number;
    longitude: number;
    locationLabel: string;
    locationSource: LocationSource;
    customerNotes: string | null;
  };
  photos: CustomerIntakePhoto[];
}

export type CustomerIntakePageData =
  | ActiveCustomerIntake
  | { status: "submitted" }
  | { status: "unavailable" };

function getLinkStatus(link: {
  expires_at: string;
  revoked_at: string | null;
  submitted_at: string | null;
}): CustomerIntakeLinkStatus {
  if (link.submitted_at) return "submitted";
  if (link.revoked_at) return "revoked";
  if (new Date(link.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

export async function getCustomerIntakeLinkSummaries(): Promise<CustomerIntakeLinkSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_intake_links")
    .select("id, job_id, expires_at, revoked_at, submitted_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load customer intake links: ${error.message}`);

  const latestByJob = new Map<string, CustomerIntakeLinkSummary>();
  for (const link of data) {
    if (!latestByJob.has(link.job_id)) {
      latestByJob.set(link.job_id, {
        id: link.id,
        jobId: link.job_id,
        status: getLinkStatus(link),
        expiresAt: link.expires_at,
        submittedAt: link.submitted_at,
        createdAt: link.created_at,
      });
    }
  }
  return [...latestByJob.values()];
}

export async function getCustomerIntakePageData(token: string): Promise<CustomerIntakePageData> {
  const parsedToken = customerTokenSchema.safeParse(token);
  if (!parsedToken.success || !hasSupabaseAdminConfig()) return { status: "unavailable" };

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("customer_intake_links")
    .select("id, job_id, expires_at, revoked_at, submitted_at")
    .eq("token_hash", hashCustomerIntakeToken(parsedToken.data))
    .maybeSingle();

  if (linkError || !link) return { status: "unavailable" };
  const status = getLinkStatus(link);
  if (status === "submitted") return { status: "submitted" };
  if (status !== "active") return { status: "unavailable" };

  await admin.rpc("mark_customer_intake_link_opened", { p_link_id: link.id });

  const [
    { data: job, error: jobError },
    { data: photos, error: photosError },
    { data: requirements, error: requirementsError },
  ] = await Promise.all([
    admin
      .from("jobs")
      .select(`
        id,
        customer_name,
        customer_phone,
        vehicle_registration,
        vehicle_make,
        rental_company,
        people_count,
        intake_pending,
        latitude,
        longitude,
        location_label,
        location_source,
        customer_notes
      `)
      .eq("id", link.job_id)
      .maybeSingle(),
    admin
      .from("job_photos")
      .select("id, original_filename, content_type, size_bytes")
      .eq("customer_intake_link_id", link.id)
      .not("uploaded_at", "is", null)
      .order("created_at"),
    admin
      .from("job_required_capabilities")
      .select("capability_code")
      .eq("job_id", link.job_id)
      .order("created_at")
      .limit(1),
  ]);

  if (jobError || photosError || requirementsError || !job) return { status: "unavailable" };

  return {
    status: "active",
    linkId: link.id,
    expiresAt: link.expires_at,
    job: {
      id: job.id,
      customerName: job.intake_pending ? "" : job.customer_name,
      customerPhone: job.customer_phone,
      vehicleRegistration: job.vehicle_registration,
      vehicleMake: job.vehicle_make,
      rentalCompany: job.rental_company,
      peopleCount: job.people_count,
      requiredCapability: requirements?.[0]?.capability_code ?? null,
      latitude: job.latitude,
      longitude: job.longitude,
      locationLabel: job.intake_pending
        ? ""
        : job.location_label ?? `${job.latitude.toFixed(5)}, ${job.longitude.toFixed(5)}`,
      locationSource: job.location_source,
      customerNotes: job.customer_notes,
    },
    photos: photos.map((photo) => ({
      id: photo.id,
      originalFilename: photo.original_filename,
      contentType: photo.content_type,
      sizeBytes: photo.size_bytes,
    })),
  };
}

export async function getActiveCustomerLinkByToken(token: string) {
  const parsedToken = customerTokenSchema.safeParse(token);
  if (!parsedToken.success || !hasSupabaseAdminConfig()) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_intake_links")
    .select("id, job_id, expires_at, revoked_at, submitted_at")
    .eq("token_hash", hashCustomerIntakeToken(parsedToken.data))
    .maybeSingle();

  return data && getLinkStatus(data) === "active" ? data : null;
}
