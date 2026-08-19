import { z } from "zod";

import {
  availabilityStatuses,
  capabilityCodes,
  vehicleTypes,
} from "@/lib/domain/types";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || null);

export const operatorInputSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(3).max(40),
  companyName: optionalTrimmedString.pipe(z.string().max(120).nullable()),
  isActive: z.boolean(),
  availabilityStatus: z.enum(availabilityStatuses),
  baseAddress: z.string().trim().min(2).max(300),
  baseLatitude: z.number().min(62).max(68),
  baseLongitude: z.number().min(-26).max(-12),
  currentLatitude: z.number().min(62).max(68).nullable(),
  currentLongitude: z.number().min(-26).max(-12).nullable(),
  serviceRadiusKm: z.number().positive().max(1000).nullable(),
  notes: optionalTrimmedString.pipe(z.string().max(2000).nullable()),
  capabilities: z.array(z.enum(capabilityCodes)).min(1),
}).superRefine((value, context) => {
  const hasLatitude = value.currentLatitude !== null;
  const hasLongitude = value.currentLongitude !== null;
  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: "custom",
      message: "Current latitude and longitude must be provided together.",
      path: hasLatitude ? ["currentLongitude"] : ["currentLatitude"],
    });
  }
});

export type OperatorInput = z.infer<typeof operatorInputSchema>;

export const vehicleInputSchema = z.object({
  id: z.uuid().nullable(),
  operatorId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  registrationNumber: optionalTrimmedString.pipe(z.string().max(24).nullable()),
  vehicleType: z.enum(vehicleTypes),
  maxVehicleWeightKg: z.number().positive().max(100_000).nullable(),
  isActive: z.boolean(),
  notes: optionalTrimmedString.pipe(z.string().max(2000).nullable()),
  capabilities: z.array(z.enum(capabilityCodes)).min(1),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const availabilityInputSchema = z.object({
  operatorId: z.uuid(),
  availabilityStatus: z.enum(availabilityStatuses),
});
