import "server-only";

import type {
  CapabilityCode,
  Job,
  JobPriority,
  JobStatus,
  LocationSource,
} from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

export interface JobOperatorMatch {
  jobId: string;
  operatorId: string;
  distanceKm: number;
  hasRequiredCapabilities: boolean;
  withinServiceArea: boolean;
}

type JobQueryRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_type: string | null;
  latitude: number;
  longitude: number;
  location_label: string | null;
  location_source: LocationSource;
  status: JobStatus;
  priority: JobPriority;
  notes: string | null;
  customer_notes: string | null;
  customer_intake_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  job_required_capabilities: { capability_code: CapabilityCode }[];
  job_photos: {
    id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    uploaded_at: string | null;
    created_at: string;
  }[];
  job_assignments: {
    id: string;
    operator_id: string;
    vehicle_id: string | null;
    assigned_at: string;
    accepted_at: string | null;
    unassigned_at: string | null;
    operators: { name: string } | null;
    vehicles: { name: string } | null;
  }[];
};

export async function getJobs(): Promise<Job[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      customer_name,
      customer_phone,
      vehicle_registration,
      vehicle_make,
      vehicle_model,
      vehicle_type,
      latitude,
      longitude,
      location_label,
      location_source,
      status,
      priority,
      notes,
      customer_notes,
      customer_intake_submitted_at,
      created_at,
      updated_at,
      completed_at,
      job_required_capabilities (capability_code),
      job_photos (
        id,
        original_filename,
        content_type,
        size_bytes,
        uploaded_at,
        created_at
      ),
      job_assignments (
        id,
        operator_id,
        vehicle_id,
        assigned_at,
        accepted_at,
        unassigned_at,
        operators (name),
        vehicles (name)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load jobs: ${error.message}`);

  return (data as unknown as JobQueryRow[]).map((job) => {
    const assignment = job.job_assignments
      .filter((item) => item.unassigned_at === null)
      .sort((left, right) => right.assigned_at.localeCompare(left.assigned_at))[0];

    return {
      id: job.id,
      customerName: job.customer_name,
      customerPhone: job.customer_phone,
      vehicleRegistration: job.vehicle_registration,
      vehicleMake: job.vehicle_make,
      vehicleModel: job.vehicle_model,
      vehicleType: job.vehicle_type,
      latitude: job.latitude,
      longitude: job.longitude,
      locationLabel: job.location_label ?? `${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)}`,
      locationSource: job.location_source,
      status: job.status,
      priority: job.priority,
      notes: job.notes,
      customerNotes: job.customer_notes,
      customerIntakeSubmittedAt: job.customer_intake_submitted_at,
      photos: job.job_photos
        .filter((photo) => photo.uploaded_at !== null)
        .map((photo) => ({
          id: photo.id,
          originalFilename: photo.original_filename,
          contentType: photo.content_type,
          sizeBytes: photo.size_bytes,
          createdAt: photo.created_at,
        })),
      requiredCapabilities: job.job_required_capabilities.map((item) => item.capability_code),
      assignment: assignment ? {
        id: assignment.id,
        operatorId: assignment.operator_id,
        operatorName: assignment.operators?.name ?? "Óþekktur aðili",
        vehicleId: assignment.vehicle_id,
        vehicleName: assignment.vehicles?.name ?? null,
        assignedAt: assignment.assigned_at,
        acceptedAt: assignment.accepted_at,
      } : null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
    };
  });
}

export async function getJobOperatorMatches(): Promise<JobOperatorMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_operator_matches")
    .select("job_id, operator_id, distance_km, has_required_capabilities, within_service_area");

  if (error) throw new Error(`Unable to load job matches: ${error.message}`);
  return data.map((match) => ({
    jobId: match.job_id,
    operatorId: match.operator_id,
    distanceKm: Number(match.distance_km),
    hasRequiredCapabilities: match.has_required_capabilities,
    withinServiceArea: match.within_service_area,
  }));
}
