import type { Job } from "@/lib/domain/types";
import { buildJobTimeline } from "./timeline";
import type { JobTimelinePageData, JobTimelineSources } from "./types";

export function buildDemoJobTimelinePageData(job: Job): JobTimelinePageData {
  const sources: JobTimelineSources = {
    job: { id: job.id, createdAt: job.createdAt, createdByName: "Sýnishamur" },
    statusEvents: job.status === "new" ? [] : [{
      id: 1,
      fromStatus: "new",
      toStatus: job.status,
      changedAt: job.updatedAt,
      changedByName: "Sýnishamur",
      notes: null,
    }],
    customerLinks: [],
    photos: job.photos.map((photo) => ({
      id: photo.id,
      originalFilename: photo.originalFilename,
      uploadedAt: photo.createdAt,
    })),
    assignments: job.assignment ? [{
      id: job.assignment.id,
      operatorName: job.assignment.operatorName,
      vehicleName: job.assignment.vehicleName,
      assignedByName: "Sýnishamur",
      assignedAt: job.assignment.assignedAt,
      acceptedAt: job.assignment.acceptedAt,
      declinedAt: null,
      declineReason: null,
      unassignedAt: null,
      notes: null,
    }] : [],
    contactEvents: [],
    billingEvents: [],
  };

  return {
    job: {
      id: job.id,
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      locationLabel: job.locationLabel,
      status: job.status,
      createdAt: job.createdAt,
    },
    events: buildJobTimeline(sources),
  };
}
