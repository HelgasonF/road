import { z } from "zod";

import {
  capabilityCodes,
  jobPriorities,
  jobStatuses,
  locationSources,
} from "@/lib/domain/types";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || null);

export const jobInputSchema = z.object({
  id: z.uuid().nullable(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(3).max(40),
  vehicleRegistration: optionalTrimmedString.pipe(z.string().max(40).nullable()),
  vehicleMake: optionalTrimmedString.pipe(z.string().max(80).nullable()),
  vehicleModel: optionalTrimmedString.pipe(z.string().max(80).nullable()),
  vehicleType: optionalTrimmedString.pipe(z.string().max(80).nullable()),
  latitude: z.number().min(62).max(68),
  longitude: z.number().min(-26).max(-12),
  locationLabel: z.string().trim().min(2).max(300),
  locationSource: z.enum(locationSources),
  priority: z.enum(jobPriorities),
  notes: optionalTrimmedString.pipe(z.string().max(4000).nullable()),
  requiredCapabilities: z.array(z.enum(capabilityCodes)).min(1),
});

export type JobInput = z.infer<typeof jobInputSchema>;

export const assignmentInputSchema = z.object({
  jobId: z.uuid(),
  operatorId: z.uuid(),
  vehicleId: z.uuid().nullable(),
  notes: z.string().trim().max(2000).nullable().transform((value) => value || null),
});

export const jobStatusInputSchema = z.object({
  jobId: z.uuid(),
  status: z.enum(jobStatuses),
  notes: z.string().trim().max(2000).nullable().transform((value) => value || null),
});
