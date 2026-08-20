import { z } from "zod";

import { availabilityStatuses } from "@/lib/domain/types";

const optionalNotes = z.string().trim().max(1000).nullable().transform((value) => value || null);

export const driverAvailabilitySchema = z.object({
  status: z.enum(availabilityStatuses),
});

export const driverAssignmentResponseSchema = z.object({
  assignmentId: z.uuid(),
  accept: z.boolean(),
  notes: optionalNotes,
}).superRefine((value, context) => {
  if (!value.accept && (!value.notes || value.notes.length < 2)) {
    context.addIssue({
      code: "custom",
      path: ["notes"],
      message: "Ástæða höfnunar er nauðsynleg.",
    });
  }
});

export const driverJobStatusSchema = z.object({
  jobId: z.uuid(),
  status: z.enum(["en_route", "on_scene", "in_progress", "transporting", "completed"]),
  notes: optionalNotes,
});
