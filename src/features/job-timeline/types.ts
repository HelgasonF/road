import type {
  BillingAction,
  JobContactChannel,
  JobContactPurpose,
  JobStatus,
} from "@/lib/domain/types";

export type JobTimelineCategory = "job" | "customer" | "driver" | "billing";
export type JobTimelineTone = "neutral" | "positive" | "warning" | "danger";
export interface JobTimelineEvent {
  id: string;
  category: JobTimelineCategory;
  title: string;
  description: string | null;
  actorName: string | null;
  occurredAt: string;
  tone: JobTimelineTone;
}

export interface JobTimelineSources {
  job: {
    id: string;
    createdAt: string;
    createdByName: string;
  };
  statusEvents: Array<{
    id: number;
    fromStatus: JobStatus | null;
    toStatus: JobStatus;
    changedByName: string;
    changedAt: string;
    notes: string | null;
  }>;
  customerLinks: Array<{
    id: string;
    createdAt: string;
    createdByName: string;
    firstOpenedAt: string | null;
    expiresAt: string;
    revokedAt: string | null;
    submittedAt: string | null;
  }>;
  photos: Array<{
    id: string;
    originalFilename: string;
    uploadedAt: string;
  }>;
  assignments: Array<{
    id: string;
    operatorName: string;
    vehicleName: string | null;
    assignedByName: string;
    assignedAt: string;
    acceptedAt: string | null;
    declinedAt: string | null;
    declineReason: string | null;
    unassignedAt: string | null;
    notes: string | null;
  }>;
  contactEvents: Array<{
    id: number;
    operatorName: string;
    channel: JobContactChannel;
    purpose: JobContactPurpose;
    initiatedByName: string;
    initiatedAt: string;
  }>;
  billingEvents: Array<{
    id: number;
    action: BillingAction;
    changedByName: string;
    changedAt: string;
    reference: string | null;
    dueAt: string | null;
    notes: string | null;
  }>;
}

export interface JobTimelinePageData {
  job: {
    id: string;
    customerName: string;
    customerPhone: string;
    locationLabel: string;
    status: JobStatus;
    createdAt: string;
  };
  events: JobTimelineEvent[];
}
